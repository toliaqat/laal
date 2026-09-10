'use server';

import { revalidatePath } from 'next/cache';
import { locales } from '@laal/i18n';
import {
  echoFields,
  fail,
  succeed,
  type ActionState,
} from '@/lib/action-result';
import { runAction } from '@/lib/run-action';
import { requireOwnedCampaign } from '@/lib/campaign-auth';

/**
 * Organizer updates: a short plain-text note to the people supporting a
 * fundraiser. RLS already restricts writes to the owning organizer (see
 * 0005_rls_remaining + 0012_campaign_updates_hardening), so these actions use
 * the ordinary cookie client — no service-role key involved.
 */

// Keep in sync with the check constraint in
// supabase/migrations/0012_campaign_updates_hardening.sql and MAX_BODY in
// update-form.tsx. Not exported: a 'use server' module may only export async
// functions.
const MAX_BODY = 2000;

/**
 * Refresh the organizer's list and every locale variant of the public page.
 * BOTH routes are locale-prefixed (`/[locale]/dashboard/...` and
 * `/[locale]/campaigns/[slug]`), so a bare `/dashboard/...` or `/campaigns/...`
 * path never matches a rendered page — it was silently a no-op.
 */
function revalidateUpdates(campaignId: string, slug: string): void {
  for (const locale of locales) {
    revalidatePath(`/${locale}/dashboard/campaigns/${campaignId}/updates`);
    revalidatePath(`/${locale}/campaigns/${slug}`);
  }
}

/** Post an update to a campaign's supporters. Organizer-only. */
export async function postUpdate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Snapshot the textarea up front so a failure hands the typing back.
  const fields = echoFields(formData, ['body']);

  return runAction(
    'campaign-updates',
    async () => {
      const campaignId = String(formData.get('campaignId') ?? '').trim();
      // eslint-disable-next-line no-restricted-syntax -- hidden-field invariant, not user-recoverable
      if (!campaignId) throw new Error('Missing campaign.'); // hidden field

      const body = String(formData.get('body') ?? '').trim();
      if (!body) return fail('update_body_required');
      if (body.length > MAX_BODY) {
        return fail('update_body_too_long', { max: MAX_BODY });
      }

      const { supabase, userId, campaign } =
        await requireOwnedCampaign(campaignId);

      const { error } = await supabase.from('campaign_updates').insert({
        campaign_id: campaignId,
        // Required by the 0012 insert policy: author_id must be the caller.
        author_id: userId,
        body,
      });
      if (error) {
        // The Postgres/PostgREST message stays server-side. `detail` only
        // controls whether the client *renders* the string — it is serialized
        // into the payload either way, and it can carry constraint names, row
        // contents and policy internals.
        console.error('[campaign-updates] insert failed', error);
        return fail('save_failed');
      }

      revalidateUpdates(campaignId, campaign.slug);
      return succeed();
    },
    fields,
  );
}

/** Remove an update the organizer posted. Organizer-only. */
export async function deleteUpdate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction('campaign-updates', async () => {
    const campaignId = String(formData.get('campaignId') ?? '').trim();
    const updateId = String(formData.get('updateId') ?? '').trim();
    // eslint-disable-next-line no-restricted-syntax -- hidden-field invariant, not user-recoverable
    if (!campaignId || !updateId) throw new Error('Missing update.');

    const { supabase, campaign } = await requireOwnedCampaign(campaignId);

    const { data: update } = await supabase
      .from('campaign_updates')
      .select('id, campaign_id')
      .eq('id', updateId)
      .maybeSingle();
    // Already gone, or belongs to a different campaign — recoverable either way.
    if (!update || update.campaign_id !== campaignId) {
      return fail('update_not_found');
    }

    const { error } = await supabase
      .from('campaign_updates')
      .delete()
      .eq('id', updateId)
      .eq('campaign_id', campaignId);
    if (error) {
      // Server-side only — see the note in postUpdate.
      console.error('[campaign-updates] delete failed', error);
      return fail('save_failed');
    }

    revalidateUpdates(campaignId, campaign.slug);
    return succeed();
  });
}
