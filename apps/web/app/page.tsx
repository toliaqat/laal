export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '2.25rem', lineHeight: 1.15, marginBottom: '0.5rem' }}>
        Ashfaat
      </h1>
      <p style={{ fontSize: '1.125rem', color: '#555', marginTop: 0 }}>
        Dignified, verified memorial fundraising for expats and their families.
      </p>

      <section style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>How it works</h2>
        <ol style={{ color: '#444', lineHeight: 1.7 }}>
          <li>Someone creates a campaign for a friend or colleague who has died abroad.</li>
          <li>Donors contribute — no account needed.</li>
          <li>We verify the death (e.g. via embassy or documents).</li>
          <li>Funds are released to a verified family member or partner organisation.</li>
        </ol>
      </section>

      <p style={{ marginTop: '2.5rem', color: '#888', fontSize: '0.875rem' }}>
        Scaffold ready. Campaign pages live at <code>/campaigns/[slug]</code>.
      </p>
    </main>
  );
}
