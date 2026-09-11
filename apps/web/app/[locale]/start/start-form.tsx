'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, Field } from '@/components/ui';
import { FormAlert } from '@/components/form';
import { CoverImageInput } from '@/components/cover-image-input';
import { createCampaign } from './actions';

type OrgOption = { id: string; name: string };

export function StartForm({ orgs }: { orgs: OrgOption[] }) {
  const t = useTranslations('start');
  const [state, formAction, pending] = useActionState(createCampaign, null);
  // Restore typed input after a failed submit (React resets the form).
  const fields = (state && !state.ok && state.fields) || {};
  const [intendedUse, setIntendedUse] = useState<
    'local_burial' | 'repatriation'
  >('local_burial');

  return (
    <form action={formAction} className="stack">
      <Card large>
        <div className="stack">
          <Field label={t('form.titleLabel')}>
            <input
              id="title"
              name="title"
              className="input"
              required
              placeholder={t('form.titlePlaceholder')}
              defaultValue={fields.title}
            />
          </Field>

          <Field label={t('form.deceasedNameLabel')}>
            <input
              id="deceased_name"
              name="deceased_name"
              className="input"
              required
              defaultValue={fields.deceased_name}
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
              defaultValue={fields.story}
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
                  defaultValue={fields.goal_amount}
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
                  defaultValue={fields.death_country}
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field
                label={t('form.deathCityLabel')}
                hint={t('form.deathCityHint')}
              >
                <input
                  id="death_city"
                  name="death_city"
                  className="input"
                  defaultValue={fields.death_city}
                />
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
                defaultValue={fields.repatriation_city}
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

          {/* Funds only ever go to a verified partner organisation. */}
          <input type="hidden" name="beneficiary_kind" value="organization" />

          {orgs.length > 0 ? (
            <Field label={t('beneficiary.partnerOrgLabel')}>
              <select
                name="organization_id"
                className="select"
                required
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
          ) : (
            <p className="small" role="status" style={{ margin: 0 }}>
              {t('beneficiary.noOrgs')}
            </p>
          )}
        </div>
      </Card>

      <FormAlert state={state} />

      <Button
        type="submit"
        variant="primary"
        block
        disabled={pending || orgs.length === 0}
      >
        {pending ? t('form.submitting') : t('form.submit')}
      </Button>
    </form>
  );
}
