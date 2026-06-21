'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { createCampaign } from './actions';

type OrgOption = { id: string; name: string };

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 600,
  marginBottom: '0.35rem',
  color: '#1a1a1a',
};

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.7rem',
  borderRadius: 8,
  border: '1px solid #d4d4d4',
  fontSize: '1rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
};

const groupStyle: CSSProperties = { marginBottom: '1.25rem' };

export function StartForm({ orgs }: { orgs: OrgOption[] }) {
  const [kind, setKind] = useState<'organization' | 'individual'>(
    orgs.length > 0 ? 'organization' : 'individual',
  );

  return (
    <form action={createCampaign} style={{ marginTop: '2rem' }}>
      <div style={groupStyle}>
        <label htmlFor="title" style={labelStyle}>
          Campaign title
        </label>
        <input id="title" name="title" required style={fieldStyle} />
      </div>

      <div style={groupStyle}>
        <label htmlFor="deceased_name" style={labelStyle}>
          Name of the deceased
        </label>
        <input
          id="deceased_name"
          name="deceased_name"
          required
          style={fieldStyle}
        />
      </div>

      <div style={groupStyle}>
        <label htmlFor="story" style={labelStyle}>
          Their story
        </label>
        <textarea
          id="story"
          name="story"
          rows={6}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', ...groupStyle }}>
        <div style={{ flex: 2 }}>
          <label htmlFor="goal_amount" style={labelStyle}>
            Goal amount
          </label>
          <input
            id="goal_amount"
            name="goal_amount"
            type="number"
            min="1"
            step="1"
            required
            style={fieldStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="currency" style={labelStyle}>
            Currency
          </label>
          <select id="currency" name="currency" defaultValue="EUR" style={fieldStyle}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="AED">AED</option>
          </select>
        </div>
      </div>

      <div style={groupStyle}>
        <label htmlFor="intended_use" style={labelStyle}>
          Intended use
        </label>
        <select
          id="intended_use"
          name="intended_use"
          defaultValue="mixed"
          style={fieldStyle}
        >
          <option value="repatriation">Repatriation</option>
          <option value="local_burial">Local burial</option>
          <option value="family_support">Family support</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '1rem', ...groupStyle }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="death_country" style={labelStyle}>
            Country of death
          </label>
          <input id="death_country" name="death_country" style={fieldStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="death_city" style={labelStyle}>
            City of death
          </label>
          <input id="death_city" name="death_city" style={fieldStyle} />
        </div>
      </div>

      <fieldset
        style={{
          border: '1px solid #e5e5e5',
          borderRadius: 12,
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <legend style={{ fontSize: '0.875rem', fontWeight: 600, padding: '0 0.5rem' }}>
          Who receives the funds?
        </legend>

        {orgs.length > 0 && (
          <label
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
              marginBottom: '0.75rem',
            }}
          >
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
          <div style={{ margin: '0 0 1rem 1.5rem' }}>
            <select name="organization_id" defaultValue="" style={fieldStyle}>
              <option value="" disabled>
                Select an organisation…
              </option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <label
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start',
          }}
        >
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
          <div style={{ margin: '0.75rem 0 0 1.5rem' }}>
            <div style={groupStyle}>
              <label htmlFor="display_name" style={labelStyle}>
                Beneficiary name
              </label>
              <input id="display_name" name="display_name" style={fieldStyle} />
            </div>
            <div>
              <label htmlFor="relationship_to_deceased" style={labelStyle}>
                Relationship to the deceased
              </label>
              <input
                id="relationship_to_deceased"
                name="relationship_to_deceased"
                style={fieldStyle}
              />
            </div>
          </div>
        )}
      </fieldset>

      <button
        type="submit"
        style={{
          width: '100%',
          padding: '0.75rem',
          borderRadius: 8,
          border: 'none',
          background: '#1a1a1a',
          color: '#fff',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Submit for review
      </button>
    </form>
  );
}
