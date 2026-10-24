#!/usr/bin/env python3
"""Prepare a traceable, unpublished dataset from the supplied Togo PDF."""

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

import pdfplumber


HERE = Path(__file__).resolve().parent
FAMILY = re.compile(
    r"^\s*(\d{1,4})\s*-\s*Famille\s*\[\s*([^\]]+?)\s*\]\s*[-–]?\s*(.*)",
    re.IGNORECASE,
)
ROW = re.compile(r"^\s*(5\s+900|[56]\d{3})\s+(.+)$")
UNITS = {
    "unité": "unite", "1 unité": "unite", "pièce": "piece",
    "ensemble": "ensemble", "jeu": "jeu", "1 jeu": "jeu",
    "paire": "paire", "1 paire": "paire", "litre": "litre", "1l": "litre",
    "5l": "5_litres", "5litres": "5_litres", "0.5litres": "0_5_litre",
    "bidon de 5l": "bidon_5_litres", "1kg": "kilogramme", "boîte": "boite",
}
ISSUES = {
    "PRICE_OUTSIDE_BOUNDS": "Le prix moyen est hors de l'intervalle LI/LS.",
    "NON_POSITIVE_PRICE": "Un montant est nul ou négatif.",
    "DUPLICATE_SOURCE_NUMBER": "Le même numéro source désigne plusieurs lignes.",
    "UNIT_PACKAGING_AMBIGUOUS": "La désignation indique un jeu, une paire ou un ensemble mais l'unité source reste unité/pièce.",
    "PILOT_SCOPE_REVIEW": "Le rattachement au périmètre pièces automobiles du pilote doit être revu.",
    "FAMILY_CLASSIFICATION_REVIEW": "La désignation paraît discordante avec la famille du PDF.",
    "SERVICE_TAX_BASIS_REVIEW": "Prestation potentielle ; le guide ne précise HT que pour les produits.",
    "OIL_GRADE_TO_REVIEW": "Le grade contient SW dans la source ; aucune correction vers 5W n'est appliquée.",
    "TYRE_DIMENSIONS_INCOMPLETE": "Une dimension avec rapport de section ne précise pas le diamètre de jante.",
    "POSSIBLE_DUPLICATE_SPECIFICATION": "Des pneus portent la même marque et dimension explicites ; les autres caractéristiques restent à vérifier.",
    "POSSIBLE_DUPLICATE_DESCRIPTION": "Même désignation, unité et contexte source ; correspondance à revoir sans fusion automatique.",
}


def clean(value):
    return re.sub(r"\s+", " ", value).strip()


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def printed_page(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return int(lines[-1]) if lines and lines[-1].isdigit() else None


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_jsonl(path, values):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(v, ensure_ascii=False) + "\n" for v in values), encoding="utf-8")


def family_key(group, ordinal, code):
    return f"group-{group:02d}/family-{ordinal}-{code or 'uncoded'}"


def extract_taxonomy(pages, pdf, profile):
    guide = pdf.pages[profile["guide_page"] - 1].extract_tables()[0]
    declared = []
    for row in guide[1:-1]:
        if len(row) != 3:
            raise ValueError(f"Unexpected guide row: {row}")
        declared.append({"number": int(row[0]), "label_raw": row[1],
                         "declared_items": int(re.sub(r"\s", "", row[2]))})
    if len(declared) != profile["declared_group_count"]:
        raise ValueError("Unexpected guide group count")
    if sum(g["declared_items"] for g in declared) != profile["declared_total_items"]:
        raise ValueError("The declared group totals do not reconcile")

    sections = []
    for number, text in enumerate(pages, 1):
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if number <= profile["usage_page"] or not lines:
            continue
        if not sections or lines[0] != sections[-1]["chapter_label_raw"]:
            sections.append({"chapter_label_raw": lines[0], "first_pdf_page": number,
                             "last_pdf_page": number, "printed_start": printed_page(text)})
        else:
            sections[-1]["last_pdf_page"] = number
    if len(sections) != len(declared):
        raise ValueError("Chapter headings do not match the 24 guide groups")

    groups, families, headings = [], {}, []
    for entry, section in zip(declared, sections):
        group = {**entry, **section, "id": f"group-{entry['number']:02d}",
                 "label": clean(entry["label_raw"]),
                 "scope": "pilot_candidate" if entry["number"] == 23 else "inactive",
                 "guide_pdf_page": profile["guide_page"]}
        groups.append(group)
        for number in range(section["first_pdf_page"], section["last_pdf_page"] + 1):
            lines = pages[number - 1].splitlines()
            for index, line in enumerate(lines):
                match = FAMILY.match(line)
                code = None
                if match:
                    ordinal, code, first_label = match.groups()
                else:
                    extra = next((e for e in profile["uncoded_sections"]
                                  if e["group_number"] == entry["number"]
                                  and re.match(r"^\s*" + e["ordinal"] + r"\s*-\s*", line)), None)
                    if not extra:
                        continue
                    ordinal, first_label = extra["ordinal"], extra["label"]
                raw_lines = [line]
                labels = [first_label]
                for continuation in lines[index + 1:]:
                    text = continuation.strip()
                    if (not text or "National" in text or re.match(r"^N[°º]", text)
                            or "Désignations" in text or re.fullmatch(r"Uni(?:tés)?", text)):
                        break
                    raw_lines.append(continuation)
                    labels.append(text)
                label = clean(" ".join(labels))
                code = clean(code) if code else None
                key = family_key(entry["number"], ordinal, code)
                heading = {"family_id": key, "ordinal_raw": ordinal, "code_raw": code,
                           "label": label, "heading_raw": "\n".join(raw_lines),
                           "pdf_page": number, "printed_page": printed_page(pages[number - 1]),
                           "text_line": index + 1}
                headings.append(heading)
                if key not in families:
                    families[key] = {"id": key, "group_id": group["id"],
                                     "ordinal_raw": ordinal, "code_raw": code, "label": label,
                                     "label_variants": [], "source_pages": [], "published": False}
                family = families[key]
                if label not in family["label_variants"]:
                    family["label_variants"].append(label)
                family["source_pages"].append({"pdf_page": number, "printed_page": heading["printed_page"]})
    return {"source_id": profile["source_id"], "groups": groups,
            "families": list(families.values())}, headings


def cell_at(table, x, y):
    cells = [c for c in table.cells if c[0] - 0.01 <= x <= c[2] + 0.01
             and c[1] - 0.01 <= y <= c[3] + 0.01]
    if not cells:
        raise ValueError(f"Missing table cell at {x}, {y}")
    return min(cells, key=lambda c: (c[2] - c[0]) * (c[3] - c[1]))


def word_cell(table, word, y=None):
    return cell_at(table, (word["x0"] + word["x1"]) / 2,
                   (word["top"] + word["bottom"]) / 2 if y is None else y)


def region_text(words, bounds):
    x0, y0, x1, y1 = bounds
    selected = [w for w in words if x0 <= (w["x0"] + w["x1"]) / 2 < x1
                and y0 <= (w["top"] + w["bottom"]) / 2 < y1]
    lines = []
    for word in sorted(selected, key=lambda w: (round(w["top"], 1), w["x0"])):
        same = next((line for line in lines if abs(line[0]["top"] - word["top"]) < 3), None)
        if same is None:
            lines.append([word])
        else:
            same.append(word)
    return "\n".join(" ".join(w["text"] for w in sorted(line, key=lambda w: w["x0"])) for line in lines)


def extract_automotive(pdf, pages, profile, taxonomy):
    scope = profile["automotive"]
    raw, records = [], []
    section = None
    family_ids = {f["id"] for f in taxonomy["families"]}
    for page_number in range(scope["first_data_page"], scope["last_data_page"] + 1):
        page = pdf.pages[page_number - 1]
        words = page.extract_words()
        for table_index, table in enumerate(page.find_tables(), 1):
            tx0, ty0, tx1, ty1 = table.bbox
            inside = [w for w in words if tx0 <= (w["x0"] + w["x1"]) / 2 <= tx1
                      and ty0 <= (w["top"] + w["bottom"]) / 2 <= ty1]
            headers = {label: next(w for w in inside if w["text"] == label)
                       for label in ["PM", "LI", "LS", "Unités", "N°"]}
            title_text = region_text(words, (tx0, ty0, tx1, min(h["top"] for h in headers.values()) - 5))
            title = clean(title_text.split("\nNational")[0])
            match = FAMILY.match(title)
            if match:
                ordinal, code = match[1], clean(match[2])
            elif re.fullmatch(r"0553\s*-\s*Autres entretiens", title):
                ordinal, code = "0553", None
            else:
                raise ValueError(f"Unknown automotive table heading p{page_number}: {title!r}")
            family_id = family_key(scope["group_number"], ordinal, code)
            if family_id not in family_ids:
                raise ValueError(f"Family not found in taxonomy: {family_id}")
            if ordinal != "0553":
                section = None
            section_headings = []
            if ordinal == "0553":
                for row, values in zip(table.rows, table.extract()):
                    nonempty = [v for v in values if v]
                    if len(nonempty) == 1 and clean(nonempty[0]).isupper() and row.bbox[1] > headers["PM"]["bottom"]:
                        label = clean(nonempty[0])
                        section_headings.append({"label_raw": label, "pdf_page": page_number,
                                                 "y": round(row.bbox[1], 3),
                                                 "kind": "product_group" if label in ["BATTERIES", "PNEUS", "DIVERS"] else "vehicle_context"})

            number_column = word_cell(table, headers["N°"])
            unit_column = word_cell(table, headers["Unités"])
            number_words = [w for w in inside if (w["x0"] + w["x1"]) / 2 < number_column[2]
                            and re.fullmatch(r"\d+", w["text"]) and w["top"] > headers["PM"]["bottom"]]
            groups = []
            for word in sorted(number_words, key=lambda w: w["top"]):
                same = next((g for g in groups if abs(g[0]["top"] - word["top"]) < 3), None)
                if same is None:
                    groups.append([word])
                else:
                    same.append(word)
            for row_index, group in enumerate(groups, 1):
                number = int("".join(w["text"] for w in sorted(group, key=lambda w: w["x0"])))
                if not scope["first_item_number"] <= number <= scope["last_item_number"]:
                    raise ValueError(f"Unexpected article number {number} p{page_number}")
                y = (group[0]["top"] + group[0]["bottom"]) / 2
                number_cell = word_cell(table, group[0])
                borders = [tx0, number_cell[2], unit_column[0], unit_column[2],
                           word_cell(table, headers["LI"], y)[0], word_cell(table, headers["LS"], y)[0], tx1]
                if borders != sorted(borders):
                    raise ValueError(f"Invalid column bounds p{page_number} t{table_index}")
                values = [region_text(words, (left, number_cell[1], right, number_cell[3]))
                          for left, right in zip(borders, borders[1:])]
                if len(values) != 6 or any(not value for value in values):
                    raise ValueError(f"Missing source field p{page_number}: {values}")
                if any(not re.fullmatch(r"[0-9\s]+", value) for value in values[3:]):
                    raise ValueError(f"Invalid source amount p{page_number}: {values}")
                if int(re.sub(r"\s", "", values[0])) != number:
                    raise ValueError("Source number cell mismatch")
                for heading in section_headings:
                    if heading["y"] < number_cell[1]:
                        section = heading
                unit = UNITS.get(clean(values[2]).casefold())
                if unit is None:
                    raise ValueError(f"Unknown unit: {values[2]!r}")
                identity = f"{profile['source_id']}:p{page_number:04d}:t{table_index:02d}:r{row_index:03d}"
                location = {"pdf_page": page_number, "printed_page": printed_page(pages[page_number - 1]),
                            "table_index": table_index, "row_index": row_index,
                            "bbox": [round(v, 3) for v in [tx0, number_cell[1], tx1, number_cell[3]]],
                            "section": dict(section) if section else None}
                raw.append({"id": identity, "source_id": profile["source_id"], "family_id": family_id,
                            "source": location, "heading_raw": title_text,
                            "cells": dict(zip(["number", "designation", "unit", "pm", "li", "ls"], values))})
                records.append({"id": identity, "source_id": profile["source_id"], "source_item_number": str(number),
                                "group_id": f"group-{scope['group_number']:02d}", "family_id": family_id,
                                "designation": clean(values[1]), "unit_raw": values[2], "unit": unit,
                                "kind": "service_candidate" if re.search(r"pré[- ]?vidange", values[1], re.I) else "product",
                                "prices": {"pm": int(re.sub(r"\s", "", values[3])),
                                           "li": int(re.sub(r"\s", "", values[4])),
                                           "ls": int(re.sub(r"\s", "", values[5])),
                                           "currency": profile["currency"], "tax_basis": "HT"},
                                "source": location,
                                "identification": {"manufacturer_reference": None, "fitment_verified": False,
                                                   "structured_attributes_extracted": False},
                                "valid_from": None, "valid_until": None,
                                "review": {"status": "ready_for_review", "codes": [], "published": False}})
        print(f"Extracted PDF page {page_number}", flush=True)
        page.close()
    return raw, records


def cross_check(records, pages, profile):
    scope = profile["automotive"]
    independent = []
    for number in range(scope["first_data_page"], scope["last_data_page"] + 1):
        for line in pages[number - 1].splitlines():
            match = ROW.match(line)
            if match:
                independent.append((number, int(re.sub(r"\s", "", match[1])), line))
    if len(records) != scope["observed_rows"] or len(independent) != len(records):
        raise ValueError(f"Row count mismatch: geometry={len(records)}, text={len(independent)}")
    for record, (page, number, line) in zip(records, independent):
        if (record["source"]["pdf_page"], int(record["source_item_number"])) != (page, number):
            raise ValueError(f"Independent row sequence mismatch: {record['id']}")
        expected = "".join(str(record["prices"][key]) for key in ["pm", "li", "ls"])
        if not re.sub(r"\s", "", line).endswith(expected):
            raise ValueError(f"Independent price mismatch: {record['id']}")
    unique = {int(r["source_item_number"]) for r in records}
    expected = set(range(scope["first_item_number"], scope["last_item_number"] + 1))
    if unique != expected or len(unique) != scope["declared_items"]:
        raise ValueError("Source article number reconciliation failed")
    return {"method": "pdfplumber geometry versus independent Poppler text",
            "rows_checked": len(records), "price_triples_checked": len(records), "mismatches": 0}


def review_data(records):
    numbers, descriptions, specifications = defaultdict(list), defaultdict(list), defaultdict(list)
    for record in records:
        codes = record["review"]["codes"]
        price = record["prices"]
        label = record["designation"]
        family_code = record["family_id"].rsplit("-", 1)[-1]
        if not price["li"] <= price["pm"] <= price["ls"]:
            codes.append("PRICE_OUTSIDE_BOUNDS")
        if any(price[key] <= 0 for key in ["pm", "li", "ls"]):
            codes.append("NON_POSITIVE_PRICE")
        if record["unit"] in ["unite", "piece"] and re.search(r"\b(?:jeux?|paire|ensemble)\b", label, re.I):
            codes.append("UNIT_PACKAGING_AMBIGUOUS")
        if family_code in ["614485", "614521", "614628"] or record["source_item_number"] == "5964":
            codes.append("PILOT_SCOPE_REVIEW")
        if (family_code == "614652" or (family_code == "614451" and "Mécanisme" in label)
                or (family_code == "614503" and re.match(r"Butée|Garniture|.*TAMBOUR", label))
                or (family_code == "614554" and label.startswith("Courroie")) or family_code == "614664"):
            codes.append("FAMILY_CLASSIFICATION_REVIEW")
        if record["kind"] == "service_candidate":
            price["tax_basis"] = "unknown"
            codes.append("SERVICE_TAX_BASIS_REVIEW")
        if re.search(r"\bSW\d{2}\b", label):
            codes.append("OIL_GRADE_TO_REVIEW")
        section = record["source"]["section"]
        if section and section["label_raw"] == "PNEUS" and re.search(r"\d{3}/\d{2}", label) and not re.search(r"\bR\s*\d{2}", label):
            codes.append("TYRE_DIMENSIONS_INCOMPLETE")
        numbers[record["source_item_number"]].append(record)
        context = section["label_raw"] if section else None
        descriptions[(clean(label).casefold(), record["unit"], context)].append(record)
        if family_code == "614615" and re.search(r"\bmichelin\b", label, re.I):
            size = re.search(r"(\d{3})\s*/\s*(\d{2})\s*R\s*(\d{2})", label, re.I)
            if size:
                specifications[("MICHELIN", size.groups())].append(record)
    for grouping, code in [(numbers, "DUPLICATE_SOURCE_NUMBER"),
                           (descriptions, "POSSIBLE_DUPLICATE_DESCRIPTION"),
                           (specifications, "POSSIBLE_DUPLICATE_SPECIFICATION")]:
        for group in grouping.values():
            if len(group) > 1:
                for record in group:
                    record["review"]["codes"].append(code)
    queue = []
    for record in records:
        record["review"]["codes"] = sorted(set(record["review"]["codes"]))
        if record["review"]["codes"]:
            record["review"]["status"] = "needs_review"
            queue.append({"id": record["id"], "source_item_number": record["source_item_number"],
                          "designation": record["designation"], "source": record["source"],
                          "issues": [{"code": code, "message": ISSUES[code]} for code in record["review"]["codes"]]})
    return queue


def write_csv(path, records, family_map, sample_groups=None):
    fields = ["id", "numero_source", "famille_ordre", "famille_code", "famille", "contexte_source",
              "designation", "unite_source", "unite_normalisee", "pm", "li", "ls", "devise",
              "base_fiscale", "page_pdf", "page_imprimee", "etat_revue", "anomalies", "publie"]
    if sample_groups:
        fields.insert(1, "groupe_echantillon")
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, delimiter=";", lineterminator="\n")
        writer.writeheader()
        for record in records:
            family = family_map[record["family_id"]]
            section = record["source"]["section"]
            row = dict(zip(fields if not sample_groups else [f for f in fields if f != "groupe_echantillon"],
                           [record["id"], record["source_item_number"], family["ordinal_raw"], family["code_raw"],
                            family["label"], section["label_raw"] if section else "", record["designation"],
                            record["unit_raw"], record["unit"], record["prices"]["pm"], record["prices"]["li"],
                            record["prices"]["ls"], record["prices"]["currency"], record["prices"]["tax_basis"],
                            record["source"]["pdf_page"], record["source"]["printed_page"], record["review"]["status"],
                            ",".join(record["review"]["codes"]), "false"]))
            if sample_groups:
                row["groupe_echantillon"] = sample_groups[record["id"]]
            writer.writerow(row)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--profile", type=Path, default=HERE / "profiles/togo-2026-01.json")
    parser.add_argument("--output", type=Path, default=HERE.parent.parent / "data/reference/2026-01")
    parser.add_argument("--source-copy", type=Path, default=HERE.parent.parent / "data/sources/repertoire-des-prix-2026-01.pdf")
    args = parser.parse_args()
    profile = json.loads(args.profile.read_text(encoding="utf-8"))
    if sha256(args.pdf) != profile["sha256"] or args.pdf.stat().st_size != profile["byte_size"]:
        raise ValueError("The PDF differs from the reviewed profile; create a profile for the new source")
    result = subprocess.run(["pdftotext", "-layout", str(args.pdf), "-"], check=True, capture_output=True, text=True)
    pages = result.stdout.split("\f")
    if not pages[-1].strip():
        pages.pop()
    if len(pages) != profile["page_count"]:
        raise ValueError(f"Unexpected page count: {len(pages)}")
    with pdfplumber.open(args.pdf) as pdf:
        if len(pdf.pages) != profile["page_count"]:
            raise ValueError("PDF readers disagree on page count")
        taxonomy, headings = extract_taxonomy(pages, pdf, profile)
        raw, records = extract_automotive(pdf, pages, profile, taxonomy)
        metadata = pdf.metadata
    reconciliation = cross_check(records, pages, profile)
    queue = review_data(records)
    family_map = {family["id"]: family for family in taxonomy["families"]}
    sample, sample_groups = [], {}
    for name, numbers in profile["sample"].items():
        for number in numbers:
            matches = [record for record in records if record["source_item_number"] == str(number)]
            if len(matches) != 1:
                raise ValueError(f"Sample number is missing or ambiguous: {number}")
            sample.append(matches[0])
            sample_groups[matches[0]["id"]] = name

    source_numbers = Counter(record["source_item_number"] for record in records)
    duplicated = [{"number": number, "occurrences": count,
                   "record_ids": [r["id"] for r in records if r["source_item_number"] == number]}
                  for number, count in source_numbers.items() if count > 1]
    ordinal_groups = defaultdict(list)
    for family in taxonomy["families"]:
        ordinal_groups[(family["group_id"], family["ordinal_raw"])].append(family["id"])
    quality = {
        "source_id": profile["source_id"], "declared_automotive_items": profile["automotive"]["declared_items"],
        "extracted_rows": len(records), "distinct_source_numbers": len(source_numbers),
        "extra_rows_from_reused_numbers": sum(value - 1 for value in source_numbers.values()),
        "missing_source_numbers": [], "duplicate_source_numbers": duplicated,
        "groups": len(taxonomy["groups"]), "detailed_families": len(taxonomy["families"]),
        "automotive_families": sum(f["group_id"] == "group-23" for f in taxonomy["families"]),
        "families_without_source_code": [f["id"] for f in taxonomy["families"] if f["code_raw"] is None],
        "reused_family_ordinals": [{"group_id": key[0], "ordinal": key[1], "families": ids}
                                   for key, ids in ordinal_groups.items() if len(ids) > 1],
        "family_label_variants": [f["id"] for f in taxonomy["families"] if len(f["label_variants"]) > 1],
        "rows_needing_review": len(queue), "rows_ready_for_review": len(records) - len(queue),
        "published_rows": 0, "sample_rows": len(sample),
        "issues_by_code": dict(sorted(Counter(code for r in records for code in r["review"]["codes"]).items())),
        "rows_by_pdf_page": dict(sorted(Counter(str(r["source"]["pdf_page"]) for r in records).items())),
        "independent_check": reconciliation,
    }
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "taxonomy.json", taxonomy)
    write_jsonl(output / "raw/taxonomy-headings.jsonl", headings)
    write_jsonl(output / "raw/automotive.jsonl", raw)
    write_json(output / "automotive.json", records)
    write_json(output / "automotive.sample.json", {"groups": sample_groups, "records": sample})
    write_json(output / "review-queue.json", queue)
    write_json(output / "quality-report.json", quality)
    write_csv(output / "automotive.csv", records, family_map)
    write_csv(output / "automotive.sample.csv", sample, family_map, sample_groups)
    excerpt_pages = [profile["guide_page"], profile["usage_page"], profile["currency_context_page"]]
    excerpt_pages += list(range(profile["automotive"]["cover_page"], profile["automotive"]["last_data_page"] + 1))
    for number in excerpt_pages:
        target = output / f"raw/pages/page-{number:04d}.txt"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(pages[number - 1].rstrip() + "\n", encoding="utf-8")
    args.source_copy.parent.mkdir(parents=True, exist_ok=True)
    if args.source_copy.exists():
        if sha256(args.source_copy) != profile["sha256"]:
            raise ValueError("An existing source copy has a different fingerprint")
    else:
        shutil.copyfile(args.pdf, args.source_copy)
    if sha256(args.source_copy) != profile["sha256"]:
        raise ValueError("Source copy fingerprint mismatch")
    manifest = {
        "schema_version": 1, "source_id": profile["source_id"], "edition": profile["edition"],
        "edition_label_on_cover": profile["edition_label_on_cover"],
        "original_filename": profile["original_filename"], "sha256": profile["sha256"],
        "byte_size": profile["byte_size"], "page_count": profile["page_count"],
        "received_on": profile["received_on"], "provenance": profile["provenance"],
        "issuer_on_cover": profile["issuer_on_cover"], "pdf_metadata": metadata,
        "download_origin_verified": False, "reference_valid_from": None, "reference_valid_until": None,
        "currency": profile["currency"], "currency_normalization": profile["currency_normalization"],
        "usage_context": "Référence pour l'évaluation de dépenses publiques ; source fournie par le porteur du projet.",
        "product_tax_basis": "HT", "tax_basis_pdf_page": profile["usage_page"],
        "coverage": {"taxonomy": "all_chapters", "price_rows": "automotive_only", "published": False},
        "extractor": {"script_sha256": sha256(Path(__file__)), "profile_sha256": sha256(args.profile),
                      "pdfplumber": pdfplumber.__version__, "pdftotext": subprocess.run(["pdftotext", "-v"], capture_output=True, text=True, check=True).stderr.splitlines()[0]},
        "artifacts": [{"path": str(path.relative_to(output)), "sha256": sha256(path), "byte_size": path.stat().st_size}
                      for path in sorted(output.rglob("*")) if path.is_file() and path.name != "manifest.json"],
    }
    write_json(output / "manifest.json", manifest)
    print(json.dumps(quality, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
