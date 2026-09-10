'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Beneficiary, Campaign } from '@laal/types';
import { Button, Card, Field } from '@/components/ui';
import { FormAlert } from '@/components/form';
import { CoverImageInput } from '@/components/cover-image-input';
import { updateCampaign } from './actions';

type OrgOption = { id: string; name: string };

export function EditForm({
  campaign,
  beneficiary,
  orgs,
}: {
  campaign: Campaign;
  beneficiary: Beneficiary | null;
  orgs: OrgOption[];
}) {
  const t = useTranslations('dashboard');
  const initialKind: 'organization' | 'individual' =
    beneficiary?.type === 'organization' ? 'organization' : 'individual';
  const [state, formAction, pending] = useActionState(updateCampaign, null);
  // Restore typed edits after a failed submit (React resets the form).
  const fields = (state && !state.ok && state.fields) || {};
  const [kind, setKind] = useState<'organization' | 'individual'>(initialKind);
  const [intendedUse, setIntendedUse] = useState(campaign.intended_use);

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="campaign_id" value={campaign.id} />

      <Card large>
        <div className="stack">
          <Field label={t('editForm.titleLabel')}>
            <input
              id="title"
              name="title"
              className="input"
              required
              defaultValue={fields.title ?? campaign.title}
            />
          </Field>

          <Field
            label={t('editForm.storyLabel')}
            hint={t('editForm.storyHint')}
          >
            <textarea
              id="story"
              name="story"
              className="textarea"
              rows={6}
              defaultValue={fields.story ?? campaign.story ?? ''}
            />
          </Field>

          <CoverImageInput
            currentUrl={campaign.cover_image_url}
            deceasedName={campaign.deceased_name}
            allowRemove
          />

          <div className="row wrap">
            <div style={{ flex: 2, minWidth: 180 }}>
              <Field label={t('editForm.goalLabel')}>
                <input
                  id="goal_amount"
                  name="goal_amount"
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  required
                  defaultValue={fields.goal_amount ?? campaign.goal_amount}
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <Field label={t('editForm.currencyLabel')}>
                <select
                  id="currency"
                  name="currency"
                  className="select"
                  defaultValue={campaign.currency}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="AED">AED</option>
                </select>
              </Field>
            </div>
          </div>

          <Field label={t('editForm.intendedUseLabel')}>
            <select
              id="intended_use"
              name="intended_use"
              className="select"
              value={intendedUse}
              onChange={(e) =>
                setIntendedUse(
                  e.target.value as 'local_burial' | 'repatriation',
                )
              }
            >
              <option value="local_burial">{t('intendedUse.local_burial')}</option>
              <option value="repatriation">{t('intendedUse.repatriation')}</option>
            </select>
          </Field>

          <div className="row wrap">
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field
                label={t('editForm.deathCountryLabel')}
                hint={t('editForm.deathCountryHint')}
              >
                <input
                  id="death_country"
                  name="death_country"
                  className="input"
                  defaultValue={fields.death_country ?? campaign.death_country ?? ''}
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field
                label={t('editForm.deathCityLabel')}
                hint={t('editForm.deathCityHint')}
              >
                <input
                  id="death_city"
                  name="death_city"
                  className="input"
                  defaultValue={fields.death_city ?? campaign.death_city ?? ''}
                />
              </Field>
            </div>
          </div>

          {intendedUse === 'repatriation' && (
            <Field
              label={t('editForm.repatriationCityLabel')}
              hint={t('editForm.repatriationCityHint')}
            >
              <input
                id="repatriation_city"
                name="repatriation_city"
                className="input"
                defaultValue={fields.repatriation_city ?? campaign.repatriation_city ?? ''}
              />
            </Field>
          )}
        </div>
      </Card>

      <Card large>
        <div className="stack">
          <div className="stack" style={{ gap: '0.25rem' }}>
            <h3 style={{ margin: 0 }}>{t('editForm.beneficiaryTitle')}</h3>
            <p className="muted small" style={{ margin: 0 }}>
              {t('editForm.beneficiaryHelp')}
            </p>
          </div>

          {orgs.length > 0 && (
            <label className="row" style={{ alignItems: 'flex-start' }}>
              <input
                type="radio"
                name="beneficiary_kind"
                value="organization"
                checked={kind === 'organization'}
                onChange={() => setKind('organization')}
              />
              <span>{t('editForm.orgOption')}</span>
            </label>
          )}

          {kind === 'organization' && orgs.length > 0 && (
            <Field label={t('editForm.partnerOrgLabel')}>
              <select
                name="organization_id"
                className="select"
                defaultValue={beneficiary?.organization_id ?? ''}
              >
                <option value="" disabled>
                  {t('editForm.selectOrgPlaceholder')}
                </option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <label className="row" style={{ alignItems: 'flex-start' }}>
            <input
              type="radio"
              name="beneficiary_kind"
              value="individual"
              checked={kind === 'individual'}
              onChange={() => setKind('individual')}
            />
            <span>{t('editForm.individualOption')}</span>
          </label>

          {kind === 'individual' && (
            <div className="stack">
              <Field
                label={t('editForm.displayNameLabel')}
                hint={t('editForm.displayNameHint')}
              >
                <input
                  id="display_name"
                  name="display_name"
                  className="input"
                  defaultValue={
                    fields.display_name ??
                    (beneficiary?.type === 'individual'
                      ? beneficiary.display_name
                      : '')
                  }
                />
              </Field>
              <Field label={t('editForm.relationshipLabel')}>
                <input
                  id="relationship_to_deceased"
                  name="relationship_to_deceased"
                  className="input"
                  defaultValue={fields.relationship_to_deceased ?? beneficiary?.relationship_to_deceased ?? ''}
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <FormAlert state={state} />

      <div className="row wrap">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t('editForm.submitting') : t('editForm.save')}
        </Button>
        <Button href="/dashboard" variant="ghost">
          {t('editForm.cancel')}
        </Button>
      </div>
    </form>
  );
}
