import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: 'system-ui, sans-serif',
        color: '#1a1a1a',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          border: '1px solid #e5e5e5',
          borderRadius: 12,
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {children}
      </div>
    </main>
  );
}
