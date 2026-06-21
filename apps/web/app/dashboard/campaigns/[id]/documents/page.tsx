import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server';
import { Container, Card, Button, Badge } from '@/components/ui';
import { uploadDocument, deleteDocument } from './actions';

export const metadata = { title: 'Documents — Laal' };

const DOC_LABELS: Record<string, string> = {
  death_certificate: 'Death certificate',
  passport: 'Passport',
  national_id: 'National ID',
  noc: 'No Objection Certificate (NOC)',
  obituary: 'Obituary',
  relationship_proof: 'Proof of relationship',
  other: 'Other',
};

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createServerSupabase();
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, title, organizer_id')
    .eq('id', id)
    .maybeSingle();
  if (!campaign || campaign.organizer_id !== user.id) redirect('/dashboard');

  const { data: documents } = await supabase
    .from('documents')
    .select('id, type, status, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });

  return (
    <Container narrow style={{ paddingTop: '2.5rem', paddingBottom: '3rem' }}>
      <p className="eyebrow">Supporting documents</p>
      <h1 style={{ marginTop: '0.25rem' }}>{campaign.title}</h1>
      <p className="muted">
        Share documents that help us verify this story — for example a death
        certificate or proof of relationship. They are private and only seen by
        our review team.
      </p>

      <Card large style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Upload a document</h3>
        <form action={uploadDocument} className="stack" style={{ gap: '1rem' }}>
          <input type="hidden" name="campaignId" value={id} />
          <div className="field">
            <label className="label">Document type</label>
            <select name="type" className="select" defaultValue="death_certificate">
              {Object.entries(DOC_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">File</label>
            <input
              name="file"
              type="file"
              className="input"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              required
            />
            <span className="hint">PDF or image, up to 8MB.</span>
          </div>
          <Button type="submit" variant="primary">
            Upload document
          </Button>
        </form>
      </Card>

      <h3 style={{ marginTop: '2rem' }}>Uploaded</h3>
      {!documents || documents.length === 0 ? (
        <p className="muted">No documents uploaded yet.</p>
      ) : (
        <div className="stack" style={{ gap: '0.6rem' }}>
          {documents.map((d) => (
            <Card key={d.id}>
              <div className="row-between wrap">
                <span>{DOC_LABELS[d.type] ?? d.type}</span>
                <span className="row wrap" style={{ gap: '0.75rem' }}>
                  <Badge
                    tone={d.status === 'approved' ? 'success' : 'warning'}
                  >
                    {d.status}
                  </Badge>
                  <form action={deleteDocument}>
                    <input type="hidden" name="campaignId" value={id} />
                    <input type="hidden" name="documentId" value={d.id} />
                    <button type="submit" className="btn btn-ghost btn-sm">
                      Remove
                    </button>
                  </form>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/dashboard" className="nav-link">
          ← Back to dashboard
        </Link>
      </p>
    </Container>
  );
}
