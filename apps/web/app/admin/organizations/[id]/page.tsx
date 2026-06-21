import { notFound } from 'next/navigation';
import { createAdminSupabase } from '@/lib/supabase/server';
import { Button, Card, Field } from '@/components/ui';
import { updateOrganization } from '../actions';

const ORG_TYPES = [
  'embassy',
  'funeral_home',
  'charity',
  'employer',
  'community',
  'religious',
] as const;

const ORG_STATUSES = ['pending', 'verified', 'suspended'] as const;

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminSupabase();
  const { data: org } = await supabase
    .from('organizations')
    .select(
      'id, name, type, country, contact_email, contact_phone, description, status, can_be_beneficiary, can_be_verifier',
    )
    .eq('id', id)
    .single();

  if (!org) notFound();

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Administration</p>
        <h1>Edit organization</h1>
        <p className="muted">{org.name}</p>
      </div>

      <Card>
        <form action={updateOrganization} className="stack">
          <input type="hidden" name="id" value={org.id} />
          <div className="grid">
            <Field label="Name">
              <input
                className="input"
                name="name"
                defaultValue={org.name ?? ''}
                required
              />
            </Field>
            <Field label="Type">
              <select
                className="select"
                name="type"
                defaultValue={org.type ?? 'charity'}
              >
                {ORG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Country">
              <input
                className="input"
                name="country"
                defaultValue={org.country ?? ''}
              />
            </Field>
            <Field label="Status">
              <select
                className="select"
                name="status"
                defaultValue={org.status ?? 'pending'}
              >
                {ORG_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contact email">
              <input
                className="input"
                type="email"
                name="contact_email"
                defaultValue={org.contact_email ?? ''}
              />
            </Field>
            <Field label="Contact phone">
              <input
                className="input"
                name="contact_phone"
                defaultValue={org.contact_phone ?? ''}
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              className="textarea"
              name="description"
              rows={4}
              defaultValue={org.description ?? ''}
            />
          </Field>
          <div className="row wrap">
            <label className="row small">
              <input
                type="checkbox"
                name="can_be_beneficiary"
                defaultChecked={Boolean(org.can_be_beneficiary)}
              />{' '}
              Can be beneficiary
            </label>
            <label className="row small">
              <input
                type="checkbox"
                name="can_be_verifier"
                defaultChecked={Boolean(org.can_be_verifier)}
              />{' '}
              Can be verifier
            </label>
          </div>
          <div className="row">
            <Button type="submit">Save changes</Button>
            <Button href="/admin/organizations" variant="ghost">
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
