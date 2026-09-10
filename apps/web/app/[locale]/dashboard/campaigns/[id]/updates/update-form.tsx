'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FormAlert, SubmitButton } from '@/components/form';
import { postUpdate } from './actions';

// Keep in sync with the check constraint in
// supabase/migrations/0012_campaign_updates_hardening.sql and MAX_BODY in
// actions.ts.
const MAX_BODY = 2000;

/**
 * Post-an-update form. The textarea is controlled so React 19's post-action
 * form reset can't wipe half a paragraph: on failure we restore the echoed
 * `fields.body`, on success we clear it.
 */
export function UpdateForm({ campaignId }: { campaignId: string }) {
  const t = useTranslations('dashboard');
  const [state, formAction] = useActionState(postUpdate, null);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!state) return;
    if (state.ok) setBody('');
    else if (typeof state.fields?.body === 'string') setBody(state.fields.body);
  }, [state]);

  const remaining = MAX_BODY - body.length;

  return (
    <form action={formAction} className="stack" style={{ gap: '1rem' }}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="field">
        <label className="label" htmlFor="update-body">
          {t('updatesPage.bodyLabel')}
        </label>
        <textarea
          id="update-body"
          name="body"
          className="textarea"
          maxLength={MAX_BODY}
          placeholder={t('updatesPage.bodyPlaceholder')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <span className="hint">
          {t('updatesPage.bodyHint', { max: MAX_BODY })}{' '}
          {t('updatesPage.remaining', { remaining })}
        </span>
      </div>
      <div>
        <SubmitButton pendingLabel={t('updatesPage.posting')}>
          {t('updatesPage.postButton')}
        </SubmitButton>
      </div>
      <FormAlert
        state={state}
        successMessage={t('updatesPage.postSuccess')}
      />
    </form>
  );
}
