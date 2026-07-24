'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import { uploadObject, documentKey, deleteObject } from '@/lib/r2';
import { fail, succeed, type ActionState } from '@/lib/action-result';
import { runAction } from '@/lib/run-action';
import type { DocumentType } from '@laal/types';

const DOC_TYPES: DocumentType[] = [
  'death_certificate',
  'passport',
  'national_id',
  'noc',
  'obituary',
  'relationship_proof',
  'other',
];
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_MB = Math.floor(MAX_BYTES / (1024 * 1024));
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/** Load the campaign, requiring the current user to be its organizer. */
async function requireOwnedCampaign(campaignId: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createServerSupabase();
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, organizer_id')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign || campaign.organizer_id !== user.id) redirect('/dashboard');
  return { supabase, userId: user.id };
}

/** Upload a supporting document to R2 and record it. Organizer-only. */
export async function uploadDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction('documents', async () => {
    const campaignId = String(formData.get('campaignId') ?? '').trim();
    const type = String(formData.get('type') ?? '').trim();
    const file = formData.get('file');

    if (!campaignId) throw new Error('Missing campaign.'); // hidden field
    if (!DOC_TYPES.includes(type as DocumentType)) {
      return fail('doc_type_invalid');
    }
    if (!(file instanceof File) || file.size === 0) {
      return fail('file_required');
    }
    if (file.size > MAX_BYTES) {
      return fail('file_too_large', { maxMb: MAX_MB });
    }
    if (!ALLOWED.includes(file.type)) {
      return fail('file_invalid_type');
    }

    const { supabase, userId } = await requireOwnedCampaign(campaignId);

    const key = documentKey(campaignId, file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadObject(key, bytes, file.type);

    const { error } = await supabase.from('documents').insert({
      campaign_id: campaignId,
      type,
      storage_path: key,
      status: 'submitted',
      uploaded_by: userId,
    });
    if (error) {
      // Roll back the orphaned object if the DB write fails.
      await deleteObject(key).catch(() => {});
      console.error('[documents]', error);
      return fail('save_failed', undefined, error.message);
    }

    revalidatePath(`/dashboard/campaigns/${campaignId}/documents`);
    return succeed();
  });
}

/** Remove a document (R2 object + row). Organizer-only. */
export async function deleteDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction('documents', async () => {
    const campaignId = String(formData.get('campaignId') ?? '').trim();
    const documentId = String(formData.get('documentId') ?? '').trim();
    if (!campaignId || !documentId) throw new Error('Missing document.');

    const { supabase } = await requireOwnedCampaign(campaignId);

    const { data: doc } = await supabase
      .from('documents')
      .select('id, storage_path, campaign_id')
      .eq('id', documentId)
      .maybeSingle();
    if (!doc || doc.campaign_id !== campaignId) redirect('/dashboard');

    await deleteObject(doc.storage_path).catch(() => {});
    await supabase.from('documents').delete().eq('id', documentId);

    revalidatePath(`/dashboard/campaigns/${campaignId}/documents`);
    return succeed();
  });
}
