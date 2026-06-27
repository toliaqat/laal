'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Beneficiary, Campaign } from '@laal/types';
import { Button, Card, Field } from '@/components/ui';
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
  const [kind, setKind] = useState<'organization' | 'individual'>(initialKind);

  return (
    <form action={updateCampaign} className="stack">
      <input type="hidden" name="campaign_id" value={campaign.id} />

      <Card large>
        <div className="stack">
          <Field label={t('editForm.titleLabel')}>
            <input
              id="title"
              name="title"
              className="input"
              required
              defaultValue={campaign.title}
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
              defaultValue={campaign.story ?? ''}
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
                  defaultValue={campaign.goal_amount}
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
              defaultValue={campaign.intended_use}
            >
              <option value="repatriation">{t('intendedUse.repatriation')}</option>
              <option value="local_burial">{t('intendedUse.local_burial')}</option>
              <option value="family_support">{t('intendedUse.family_support')}</option>
              <option value="mixed">{t('intendedUse.mixed')}</option>
            </select>
          </Field>

          <div className="row wrap">
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field label={t('editForm.deathCountryLabel')}>
                <input
                  id="death_country"
                  name="death_country"
                  className="input"
                  defaultValue={campaign.death_country ?? ''}
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field label={t('editForm.deathCityLabel')}>
                <input
                  id="death_city"
                  name="death_city"
                  className="input"
                  defaultValue={campaign.death_city ?? ''}
                />
              </Field>
            </div>
          </div>
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
              <Field label={t('editForm.displayNameLabel')}>
                <input
                  id="display_name"
                  name="display_name"
                  className="input"
                  defaultValue={
                    beneficiary?.type === 'individual'
                      ? beneficiary.display_name
                      : ''
                  }
                />
              </Field>
              <Field label={t('editForm.relationshipLabel')}>
                <input
                  id="relationship_to_deceased"
                  name="relationship_to_deceased"
                  className="input"
                  defaultValue={beneficiary?.relationship_to_deceased ?? ''}
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <div className="row wrap">
        <Button type="submit" variant="primary">
          {t('editForm.save')}
        </Button>
        <Button href="/dashboard" variant="ghost">
          {t('editForm.cancel')}
        </Button>
      </div>
    </form>
  );
}
