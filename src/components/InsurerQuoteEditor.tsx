import { createElement, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { searchPublishedPrices } from '@/lib/catalog';
import { saveInsurerEstimate, type InsurerEstimateWithLines, type SaveEstimateLine } from '@/lib/insurer-dossiers';

type SearchResult = Awaited<ReturnType<typeof searchPublishedPrices>>[number];
type PartCondition = 'new' | 'reconditioned' | 'used';
type PartQuality = 'original' | 'equivalent' | 'reconditioned' | 'used';
type DraftLine = {
  key: string;
  designation: string;
  quantity: string;
  unitPrice: string;
  taxBasis: 'HT' | 'TTC' | 'unknown';
  condition: PartCondition | null;
  quality: PartQuality | null;
  unitCode: string | null;
  productId: string | null;
  referenceLabel: string;
};

function productOf(item: SearchResult) {
  return Array.isArray(item.products) ? item.products[0] ?? null : item.products;
}

function unitOf(item: SearchResult) {
  const unit = Array.isArray(item.units) ? item.units[0] : item.units;
  return unit?.label ?? productOf(item)?.unit_code ?? 'unité';
}

function lineDraft(line?: InsurerEstimateWithLines['lines'][number]): DraftLine {
  return {
    key: line?.id ?? ('new-' + Date.now() + '-' + Math.random().toString(16).slice(2)),
    designation: line?.designation ?? '',
    quantity: line ? String(line.quantity) : '1',
    unitPrice: line ? String(line.unit_price) : '',
    taxBasis: line?.tax_basis === 'HT' || line?.tax_basis === 'TTC' ? line.tax_basis : 'unknown',
    condition: line?.condition === 'new' || line?.condition === 'reconditioned' || line?.condition === 'used' ? line.condition : null,
    quality: line?.quality === 'original' || line?.quality === 'equivalent' || line?.quality === 'reconditioned' || line?.quality === 'used' ? line.quality : null,
    unitCode: line?.unit_code ?? null,
    productId: line?.selected_product_id ?? null,
    referenceLabel: line?.selected_product_id ? 'Référence déjà associée' : '',
  };
}

function number(value: string) {
  const parsed = Number(value.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' ' + currency;
}

export function InsurerQuoteEditor({ estimate, index, disabled, expanded, onToggle, onSaved }: {
  estimate: InsurerEstimateWithLines;
  index: number;
  disabled: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => Promise<void>;
}) {
  const [supplierName, setSupplierName] = useState(estimate.supplier_name);
  const [reference, setReference] = useState(estimate.quote_reference ?? '');
  const [quoteDate, setQuoteDate] = useState(estimate.quote_date ?? '');
  const [lines, setLines] = useState<DraftLine[]>(estimate.lines.map(lineDraft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const values: SaveEstimateLine[] = [];
    for (const [position, line] of lines.entries()) {
      const quantity = number(line.quantity);
      const unitPrice = number(line.unitPrice);
      if (line.designation.trim().length < 2 || quantity === null || quantity <= 0 || unitPrice === null || unitPrice < 0) {
        setError('Chaque ligne doit avoir une désignation, une quantité positive et un prix unitaire valide.');
        return;
      }
      values.push({
        position: position + 1,
        designation: line.designation.trim(),
        quantity,
        unit_code: line.unitCode,
        unit_price: unitPrice,
        currency: 'XOF',
        tax_basis: line.taxBasis,
        condition: line.condition,
        quality: line.quality,
        tax_rate: null,
        selected_product_id: line.productId,
        matching_note: null,
      });
    }
    if (!values.length) {
      setError('Ajoute au moins une pièce avant d’enregistrer ce devis.');
      return;
    }
    setSaving(true);
    try {
      await saveInsurerEstimate({ estimateId: estimate.id, supplierName, quoteReference: reference, quoteDate, lines: values });
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Le devis n’a pas pu être enregistré.');
    } finally {
      setSaving(false);
    }
  }

  function update(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.summaryHeader}>
        <View style={styles.summaryInfo}>
          <View style={styles.summaryTitleRow}><Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text><Text numberOfLines={1} style={styles.supplier}>{supplierName || estimate.supplier_name}</Text></View>
          <Text numberOfLines={2} style={styles.note}>{lines.length} pièce{lines.length === 1 ? '' : 's'} · {reference.trim() || 'Référence à préciser'} · {quoteDate || 'Date à préciser'}</Text>
        </View>
        <View style={styles.expandButton}><Text style={styles.expandText}>{expanded ? 'Masquer' : lines.length ? 'Modifier' : 'Renseigner'}</Text><Text style={styles.expandMark}>{expanded ? '−' : '+'}</Text></View>
      </Pressable>
      {expanded && <View style={styles.editorBody}>
        <View style={styles.detailsGrid}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Concessionnaire</Text>
            <TextInput value={supplierName} onChangeText={setSupplierName} editable={!disabled} placeholder="Nom du concessionnaire" style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Référence du devis</Text>
            <TextInput value={reference} onChangeText={setReference} editable={!disabled} placeholder="Ex. DV-2026-014" style={styles.input} />
          </View>
          <View style={[styles.field, styles.dateField]}>
            <Text style={styles.fieldLabel}>Date du devis</Text>
            {Platform.OS === 'web' ? createElement('input', {
              type: 'date',
              value: quoteDate,
              disabled,
              'aria-label': 'Date du devis',
              onChange: (event) => setQuoteDate(event.currentTarget.value),
              style: {
                boxSizing: 'border-box',
                display: 'block',
                width: '100%',
                minWidth: 0,
                minHeight: 46,
                padding: '0 12px',
                border: '1px solid #DCE5EC',
                borderRadius: 10,
                color: '#23425F',
                backgroundColor: disabled ? '#F3F6F8' : '#FFF',
                colorScheme: 'light',
                fontFamily: 'inherit',
                fontSize: 15,
              },
            }) : <TextInput value={quoteDate} onChangeText={setQuoteDate} editable={!disabled} placeholder="AAAA-MM-JJ" style={styles.input} />}
          </View>
        </View>
        {lines.map((line) => <QuoteLine key={line.key} line={line} disabled={disabled} onChange={(patch) => update(line.key, patch)} onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))} />)}
        <View style={styles.actions}>
          <Pressable disabled={disabled} onPress={() => setLines((current) => [...current, lineDraft()])}><Text style={styles.add}>+ Ajouter une pièce</Text></Pressable>
          <Pressable disabled={saving || disabled} onPress={() => { void save(); }} style={[styles.save, (saving || disabled) && styles.disabled]}>{saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveText}>Enregistrer le devis</Text>}</Pressable>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>}
    </View>
  );
}

function QuoteLine({ line, disabled, onChange, onRemove }: {
  line: DraftLine;
  disabled: boolean;
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (query.trim().length < 2) {
      setError('Saisis au moins deux caractères.');
      return;
    }
    setSearching(true);
    setError(null);
    try {
      setResults((await searchPublishedPrices(query.trim())).slice(0, 5));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Recherche de référence indisponible.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <View style={styles.line}>
      <View style={styles.titleRow}><Text style={styles.lineTitle}>{line.designation || 'Nouvelle pièce'}</Text>{!disabled && <Pressable onPress={onRemove}><Text style={styles.remove}>Retirer</Text></Pressable>}</View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Désignation sur le devis</Text>
        <TextInput value={line.designation} onChangeText={(value) => onChange({ designation: value })} editable={!disabled} placeholder="Ex. phare avant gauche" style={styles.input} />
      </View>
      <View style={[styles.field, styles.searchField]}>
        <Text style={styles.fieldLabel}>Référence dans le catalogue Check</Text>
        <View style={styles.row}>
          <TextInput value={query} onChangeText={setQuery} editable={!disabled} onSubmitEditing={() => { void search(); }} placeholder="Nom ou référence de la pièce" style={styles.referenceInput} />
          <Pressable disabled={disabled || searching} onPress={() => { void search(); }} style={styles.search}>{searching ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.searchText}>Chercher</Text>}</Pressable>
        </View>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {line.productId && <View style={styles.selected}><Text style={styles.selectedText}>✓ {line.referenceLabel} · unité {line.unitCode ?? 'à préciser'}</Text><Pressable disabled={disabled} onPress={() => onChange({ productId: null, unitCode: null, referenceLabel: '' })}><Text style={styles.remove}>Retirer</Text></Pressable></View>}
      <View style={styles.choiceGrid}>
        <ChoiceRow
          label="État recherché"
          value={line.condition}
          disabled={disabled}
          options={[
            { value: null, label: 'Tous les états' },
            { value: 'new', label: 'Neuf' },
            { value: 'reconditioned', label: 'Reconditionné' },
            { value: 'used', label: 'Occasion' },
          ]}
          onChange={(value) => onChange({ condition: value as PartCondition | null })}
        />
        <ChoiceRow
          label="Qualité recherchée"
          value={line.quality}
          disabled={disabled}
          options={[
            { value: null, label: 'Toutes les qualités' },
            { value: 'original', label: 'Origine constructeur' },
            { value: 'equivalent', label: 'Équivalent' },
            { value: 'reconditioned', label: 'Reconditionné' },
            { value: 'used', label: 'Occasion' },
          ]}
          onChange={(value) => onChange({ quality: value as PartQuality | null })}
        />
      </View>
      <Text style={styles.choiceHint}>Sans filtre, Check proposera les offres compatibles de tous les états et affichera leur état réel.</Text>
      {results.map((result) => {
        const product = productOf(result);
        if (!product) return null;
        return <Pressable key={result.id} onPress={() => { onChange({ productId: product.id, unitCode: product.unit_code, referenceLabel: product.name }); setResults([]); setQuery(''); }} style={styles.searchResult}><View style={styles.flex}><Text style={styles.resultName}>{product.name}</Text><Text style={styles.note}>{unitOf(result)} · moyenne {money(result.pm, result.currency)}</Text></View><Text style={styles.choose}>Choisir</Text></Pressable>;
      })}
      <View style={styles.row}>
        <View style={[styles.field, styles.numberField]}>
          <Text style={styles.fieldLabel}>Quantité</Text>
          <TextInput value={line.quantity} onChangeText={(value) => onChange({ quantity: value })} editable={!disabled} keyboardType="decimal-pad" placeholder="1" style={styles.numberInput} />
        </View>
        <View style={[styles.field, styles.numberField]}>
          <Text style={styles.fieldLabel}>Prix unitaire (XOF)</Text>
          <TextInput value={line.unitPrice} onChangeText={(value) => onChange({ unitPrice: value })} editable={!disabled} keyboardType="decimal-pad" placeholder="0" style={styles.numberInput} />
        </View>
        <View style={[styles.field, styles.taxField]}>
          <Text style={styles.fieldLabel}>Base fiscale</Text>
          <View style={styles.taxRow}>{(['HT', 'TTC', 'unknown'] as const).map((basis) => <Pressable key={basis} disabled={disabled} onPress={() => onChange({ taxBasis: basis })} style={[styles.taxChip, line.taxBasis === basis && styles.taxActive]}><Text style={styles.taxText}>{basis === 'unknown' ? 'À préciser' : basis}</Text></Pressable>)}</View>
        </View>
      </View>
    </View>
  );
}

function ChoiceRow({ label, value, options, disabled, onChange }: {
  label: string;
  value: string | null;
  options: { value: string | null; label: string }[];
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  return <View style={styles.choiceField}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.choiceOptions}>
      {options.map((option) => <Pressable
        key={option.value ?? 'all'}
        disabled={disabled}
        onPress={() => onChange(option.value)}
        accessibilityRole="button"
        accessibilityState={{ selected: value === option.value, disabled }}
        style={[styles.choiceChip, value === option.value && styles.choiceChipActive, disabled && styles.disabled]}
      >
        <Text style={[styles.choiceText, value === option.value && styles.choiceTextActive]}>{option.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { marginTop: 12, padding: 18, borderWidth: 1, borderColor: '#DCE6EF', borderRadius: 14, backgroundColor: '#FAFCFE' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryInfo: { flex: 1, minWidth: 0 },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  editorBody: { marginTop: 12, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#E4EBF1' },
  expandButton: { minHeight: 38, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#C9D9E7', borderRadius: 9, backgroundColor: '#F7FAFC' },
  expandText: { color: '#286DAB', fontSize: 12, fontWeight: '800' },
  expandMark: { color: '#286DAB', fontSize: 16, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  number: { color: '#397FBD', fontSize: 13, fontWeight: '900' },
  flex: { flex: 1, minWidth: 0 },
  supplier: { color: '#1B3C5A', fontSize: 16, fontWeight: '800' },
  note: { marginTop: 4, color: '#65798B', fontSize: 12 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, marginTop: 8 },
  field: { flex: 1, minWidth: 180 },
  dateField: { minWidth: 210 },
  searchField: { marginTop: 12 },
  numberField: { minWidth: 135 },
  taxField: { flex: 0, minWidth: 170 },
  fieldLabel: { marginBottom: 6, color: '#4E667C', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: '#CCD9E4', borderRadius: 10, color: '#193A59', backgroundColor: '#FFF', fontSize: 14 },
  line: { marginTop: 12, padding: 14, borderWidth: 1, borderColor: '#DFE7EE', borderRadius: 12, backgroundColor: '#FFF' },
  lineTitle: { flex: 1, color: '#193A59', fontSize: 14, fontWeight: '800' },
  remove: { color: '#A7433B', fontSize: 12, fontWeight: '700' },
  referenceInput: { flex: 1, minWidth: 190, minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: '#CCD9E4', borderRadius: 10, color: '#193A59', fontSize: 14 },
  search: { minHeight: 46, minWidth: 100, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: '#397FBD' },
  searchText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  selected: { marginTop: 10, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 9, backgroundColor: '#EAF5EF' },
  selectedText: { flex: 1, color: '#286647', fontSize: 12 },
  searchResult: { marginTop: 8, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 9, borderWidth: 1, borderColor: '#DCE5EC' },
  resultName: { color: '#193A59', fontSize: 13, fontWeight: '800' },
  choose: { color: '#286DAB', fontSize: 12, fontWeight: '800' },
  numberInput: { flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: '#CCD9E4', borderRadius: 10, color: '#193A59', fontSize: 16, fontWeight: '600' },
  choiceGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choiceField: { flex: 1, minWidth: 240 },
  choiceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choiceChip: { minHeight: 36, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#CCD9E4', backgroundColor: '#FFF' },
  choiceChipActive: { borderColor: '#397FBD', backgroundColor: '#EAF4FE' },
  choiceText: { color: '#36536B', fontSize: 11, fontWeight: '700' },
  choiceTextActive: { color: '#286DAB', fontWeight: '900' },
  choiceHint: { marginTop: 7, color: '#71889B', fontSize: 11, lineHeight: 16 },
  taxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  taxChip: { minWidth: 52, minHeight: 42, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#CCD9E4', backgroundColor: '#FFF' },
  taxActive: { backgroundColor: '#EAF4FE', borderColor: '#397FBD' },
  taxText: { color: '#36536B', fontSize: 12, fontWeight: '800' },
  actions: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  add: { color: '#286DAB', fontSize: 13, fontWeight: '800' },
  save: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 9, backgroundColor: '#193F68' },
  saveText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: .5 },
  error: { marginTop: 8, color: '#A13E37', fontSize: 12 },
});
