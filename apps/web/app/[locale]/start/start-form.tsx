'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, Field } from '@/components/ui';
import { CoverImageInput } from '@/components/cover-image-input';
import { createCampaign } from './actions';

type OrgOption = { id: string; name: string };

export function StartForm({ orgs }: { orgs: OrgOption[] }) {
  const t = useTranslations('start');
  const [kind, setKind] = useState<'organization' | 'individual'>(
    orgs.length > 0 ? 'organization' : 'individual',
  );
  const [intendedUse, setIntendedUse] = useState<
    'local_burial' | 'repatriation'
  >('local_burial');

  return (
    <form action={createCampaign} className="stack">
      <Card large>
        <div className="stack">
          <Field label={t('form.titleLabel')}>
            <input
              id="title"
              name="title"
              className="input"
              required
              placeholder={t('form.titlePlaceholder')}
            />
          </Field>

          <Field label={t('form.deceasedNameLabel')}>
            <input
              id="deceased_name"
              name="deceased_name"
              className="input"
              required
            />
          </Field>

          <Field
            label={t('form.storyLabel')}
            hint={t('form.storyHint')}
          >
            <textarea
              id="story"
              name="story"
              className="textarea"
              rows={6}
            />
          </Field>

          <CoverImageInput />

          <div className="row wrap">
            <div style={{ flex: 2, minWidth: 180 }}>
              <Field label={t('form.goalLabel')}>
                <input
                  id="goal_amount"
                  name="goal_amount"
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  required
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <Field label={t('form.currencyLabel')}>
                <select
                  id="currency"
                  name="currency"
                  className="select"
                  defaultValue="EUR"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="AED">AED</option>
                </select>
              </Field>
            </div>
          </div>

          <Field label={t('form.intendedUseLabel')}>
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
              <option value="local_burial">{t('intendedUse.localBurial')}</option>
              <option value="repatriation">{t('intendedUse.repatriation')}</option>
            </select>
          </Field>

          <div className="row wrap">
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field
                label={t('form.deathCountryLabel')}
                hint={t('form.deathCountryHint')}
              >
                <input
                  id="death_country"
                  name="death_country"
                  className="input"
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field
                label={t('form.deathCityLabel')}
                hint={t('form.deathCityHint')}
              >
                <input id="death_city" name="death_city" className="input" />
              </Field>
            </div>
          </div>

          {intendedUse === 'repatriation' && (
            <Field
              label={t('form.repatriationCityLabel')}
              hint={t('form.repatriationCityHint')}
            >
              <input
                id="repatriation_city"
                name="repatriation_city"
                className="input"
              />
            </Field>
          )}
        </div>
      </Card>

      <Card large>
        <div className="stack">
          <div className="stack" style={{ gap: '0.25rem' }}>
            <h3 style={{ margin: 0 }}>{t('beneficiary.heading')}</h3>
            <p className="muted small" style={{ margin: 0 }}>
              {t('beneficiary.description')}
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
              <span>{t('beneficiary.organizationOption')}</span>
            </label>
          )}

          {kind === 'organization' && orgs.length > 0 && (
            <Field label={t('beneficiary.partnerOrgLabel')}>
              <select
                name="organization_id"
                className="select"
                defaultValue=""
              >
                <option value="" disabled>
                  {t('beneficiary.selectOrgPlaceholder')}
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
            <span>{t('beneficiary.individualOption')}</span>
          </label>

          {kind === 'individual' && (
            <div className="stack">
              <Field label={t('beneficiary.displayNameLabel')}>
                <input
                  id="display_name"
                  name="display_name"
                  className="input"
                />
              </Field>
              <Field label={t('beneficiary.relationshipLabel')}>
                <input
                  id="relationship_to_deceased"
                  name="relationship_to_deceased"
                  className="input"
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Button type="submit" variant="primary" block>
        {t('form.submit')}
      </Button>
    </form>
  );
}
