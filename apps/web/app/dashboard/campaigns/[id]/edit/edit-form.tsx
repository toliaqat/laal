'use client';

import { useState } from 'react';
import type { Beneficiary, Campaign } from '@ashfaat/types';
import { Button, Card, Field } from '@/components/ui';
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
  const initialKind: 'organization' | 'individual' =
    beneficiary?.type === 'organization' ? 'organization' : 'individual';
  const [kind, setKind] = useState<'organization' | 'individual'>(initialKind);

  return (
    <form action={updateCampaign} className="stack">
      <input type="hidden" name="campaign_id" value={campaign.id} />

      <Card large>
        <div className="stack">
          <Field label="Campaign title">
            <input
              id="title"
              name="title"
              className="input"
              required
              defaultValue={campaign.title}
            />
          </Field>

          <Field
            label="Their story"
            hint="Share who they were and how the funds will help."
          >
            <textarea
              id="story"
              name="story"
              className="textarea"
              rows={6}
              defaultValue={campaign.story ?? ''}
            />
          </Field>

          <div className="row wrap">
            <div style={{ flex: 2, minWidth: 180 }}>
              <Field label="Fundraising target">
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
              <Field label="Currency">
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

          <Field label="Intended use">
            <select
              id="intended_use"
              name="intended_use"
              className="select"
              defaultValue={campaign.intended_use}
            >
              <option value="repatriation">Repatriation</option>
              <option value="local_burial">Local burial</option>
              <option value="family_support">Family support</option>
              <option value="mixed">Mixed</option>
            </select>
          </Field>

          <div className="row wrap">
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field label="Country of death">
                <input
                  id="death_country"
                  name="death_country"
                  className="input"
                  defaultValue={campaign.death_country ?? ''}
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field label="City of death">
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
            <h3 style={{ margin: 0 }}>Who receives the funds?</h3>
            <p className="muted small" style={{ margin: 0 }}>
              Choose a verified partner organisation, or an individual such as
              yourself or a family member.
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
              <span>A verified partner organisation</span>
            </label>
          )}

          {kind === 'organization' && orgs.length > 0 && (
            <Field label="Partner organisation">
              <select
                name="organization_id"
                className="select"
                defaultValue={beneficiary?.organization_id ?? ''}
              >
                <option value="" disabled>
                  Select an organisation…
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
            <span>An individual (myself / family)</span>
          </label>

          {kind === 'individual' && (
            <div className="stack">
              <Field label="Beneficiary name">
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
              <Field label="Relationship to the deceased">
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
          Save changes
        </Button>
        <Button href="/dashboard" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
