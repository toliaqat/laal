'use client';

import { useState } from 'react';
import { Button, Card, Field } from '@/components/ui';
import { CoverImageInput } from '@/components/cover-image-input';
import { createCampaign } from './actions';

type OrgOption = { id: string; name: string };

export function StartForm({ orgs }: { orgs: OrgOption[] }) {
  const [kind, setKind] = useState<'organization' | 'individual'>(
    orgs.length > 0 ? 'organization' : 'individual',
  );

  return (
    <form action={createCampaign} className="stack">
      <Card large>
        <div className="stack">
          <Field label="Fundraiser title">
            <input
              id="title"
              name="title"
              className="input"
              required
              placeholder="e.g. Bring Ahmed home to Lahore"
            />
          </Field>

          <Field label="Name of the deceased">
            <input
              id="deceased_name"
              name="deceased_name"
              className="input"
              required
            />
          </Field>

          <Field
            label="Their story"
            hint="Tell us who they were and how this support will help their family."
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
              <Field label="Support goal">
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
              <Field label="Currency">
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

          <Field label="Intended use">
            <select
              id="intended_use"
              name="intended_use"
              className="select"
              defaultValue="mixed"
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
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field label="City of death">
                <input id="death_city" name="death_city" className="input" />
              </Field>
            </div>
          </div>
        </div>
      </Card>

      <Card large>
        <div className="stack">
          <div className="stack" style={{ gap: '0.25rem' }}>
            <h3 style={{ margin: 0 }}>Who receives the support?</h3>
            <p className="muted small" style={{ margin: 0 }}>
              Choose a verified partner organisation, or a person such as
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
                defaultValue=""
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
              <Field label="Name of the person we'll support">
                <input
                  id="display_name"
                  name="display_name"
                  className="input"
                />
              </Field>
              <Field label="Relationship to the deceased">
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
        Submit for review
      </Button>
    </form>
  );
}
