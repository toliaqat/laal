import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="hero-bg"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="card card-pad-lg container-narrow"
        style={{ width: '100%', maxWidth: 420 }}
      >
        {children}
      </div>
    </main>
  );
}
