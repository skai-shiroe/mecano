import type { Database } from '@/types/database';
import { supabase } from '@/lib/supabase';

export type ReviewIssueStatus = 'open' | 'resolved' | 'dismissed';

type IssueRow = Database['public']['Tables']['reference_entry_issues']['Row'];
type EntryRow = Database['public']['Tables']['reference_entries']['Row'];
type FamilyRow = Database['public']['Tables']['source_families']['Row'];
type GroupRow = Database['public']['Tables']['source_groups']['Row'];

type IssueFields = Pick<
  IssueRow,
  'id' | 'reference_entry_id' | 'code' | 'message' | 'status' |
  'resolution_note' | 'resolved_by' | 'resolved_at' | 'created_at'
>;

type EntryFields = Pick<
  EntryRow,
  'id' | 'source_id' | 'source_family_id' | 'source_item_number' | 'designation' |
  'unit_raw' | 'unit_code' | 'kind' | 'pm' | 'li' | 'ls' | 'currency' |
  'tax_basis' | 'pdf_page' | 'printed_page' | 'review_status' | 'category_id'
>;

export type ReferenceIssueForReview = Omit<IssueFields, 'status'> & {
  status: ReviewIssueStatus;
  entry: EntryFields & {
    source_family_label: string | null;
    source_group_label: string | null;
    family_mapping_status: string | null;
  };
};

export async function getReferenceIssuesForReview(): Promise<ReferenceIssueForReview[]> {
  const { data: issueRows, error: issueError } = await supabase
    .from('reference_entry_issues')
    .select('id,reference_entry_id,code,message,status,resolution_note,resolved_by,resolved_at,created_at')
    .order('created_at', { ascending: true })
    .limit(250);

  if (issueError) throw issueError;
  if (!issueRows?.length) return [];

  const entryIds = [...new Set(issueRows.map((issue) => issue.reference_entry_id))];
  const { data: entryRows, error: entryError } = await supabase
    .from('reference_entries')
    .select('id,source_id,source_family_id,source_item_number,designation,unit_raw,unit_code,kind,pm,li,ls,currency,tax_basis,pdf_page,printed_page,review_status,category_id')
    .in('id', entryIds);

  if (entryError) throw entryError;
  const entries = (entryRows ?? []) as EntryFields[];
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const familyIds = [...new Set(entries.map((entry) => entry.source_family_id))];

  const { data: familyRows, error: familyError } = await supabase
    .from('source_families')
    .select('id,label,source_group_id,mapping_status')
    .in('id', familyIds);

  if (familyError) throw familyError;
  const families = (familyRows ?? []) as Pick<FamilyRow, 'id' | 'label' | 'source_group_id' | 'mapping_status'>[];
  const familyById = new Map(families.map((family) => [family.id, family]));
  const groupIds = [...new Set(families.map((family) => family.source_group_id))];

  const { data: groupRows, error: groupError } = await supabase
    .from('source_groups')
    .select('id,label_raw')
    .in('id', groupIds);

  if (groupError) throw groupError;
  const groups = (groupRows ?? []) as Pick<GroupRow, 'id' | 'label_raw'>[];
  const groupById = new Map(groups.map((group) => [group.id, group]));

  return issueRows.map((issue) => {
    const entry = entryById.get(issue.reference_entry_id);
    if (!entry) throw new Error('Une alerte ne possède pas sa ligne source associée.');
    const family = familyById.get(entry.source_family_id);
    const group = family ? groupById.get(family.source_group_id) : undefined;

    return {
      ...issue,
      status: issue.status as ReviewIssueStatus,
      entry: {
        ...entry,
        source_family_label: family?.label ?? null,
        source_group_label: group?.label_raw ?? null,
        family_mapping_status: family?.mapping_status ?? null,
      },
    };
  });
}

export async function setReferenceIssueDecision(input: {
  issueId: string;
  status: ReviewIssueStatus;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('resolve_reference_entry_issue', {
    p_issue_id: input.issueId,
    p_status: input.status,
    p_resolution_note: input.note,
  });

  if (error) throw error;
}
