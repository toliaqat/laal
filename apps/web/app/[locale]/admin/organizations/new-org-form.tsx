'use client';

import { useActionState, useState } from 'react';
import { Button, Card, Field } from '@/components/ui';
import { FormAlert } from '@/components/form';
import { createOrganization } from './actions';

const ORG_TYPES = [
  'embassy',
  'funeral_home',
  'charity',
  'employer',
  'community',
  'religious',
] as const;

export function NewOrganizationForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createOrganization, null);

  if (!open) {
    return (
      <div className="row">
        <Button onClick={() => setOpen(true)}>New organization</Button>
      </div>
    );
  }

  return (
    <Card>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>New organization</h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <form action={formAction} className="stack">
        <div className="grid">
          <Field label="Name">
            <input className="input" name="name" required />
          </Field>
          <Field label="Type">
            <select className="select" name="type" defaultValue="charity">
              {ORG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Country">
            <input className="input" name="country" />
          </Field>
          <Field label="Contact email">
            <input className="input" type="email" name="contact_email" />
          </Field>
          <Field label="Contact phone">
            <input className="input" name="contact_phone" />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="textarea" name="description" rows={3} />
        </Field>
        <div className="row wrap">
          <label className="row small">
            <input type="checkbox" name="can_be_beneficiary" /> Can be
            beneficiary
          </label>
          <label className="row small">
            <input type="checkbox" name="can_be_verifier" /> Can be verifier
          </label>
        </div>
        <FormAlert state={state} showDetail />
        <div className="row">
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create organization'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
