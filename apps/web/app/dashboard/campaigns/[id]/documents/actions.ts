'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import { uploadObject, documentKey, deleteObject } from '@/lib/r2';
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
export async function uploadDocument(formData: FormData): Promise<void> {
  const campaignId = String(formData.get('campaignId') ?? '').trim();
  const type = String(formData.get('type') ?? '').trim();
  const file = formData.get('file');

  if (!campaignId) throw new Error('Missing campaign.');
  if (!DOC_TYPES.includes(type as DocumentType)) {
    throw new Error('Please choose a valid document type.');
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Please choose a file to upload.');
  }
  if (file.size > MAX_BYTES) throw new Error('File is too large (max 8MB).');
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Only PDF or image files (PDF, JPG, PNG, WebP) are allowed.');
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
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}/documents`);
}

/** Remove a document (R2 object + row). Organizer-only. */
export async function deleteDocument(formData: FormData): Promise<void> {
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
}
