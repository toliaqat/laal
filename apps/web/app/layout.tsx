import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Ashfaat — Support expat families in loss',
  description:
    'Create or contribute to a memorial fund for an expat who has passed away. Verified, transparent, dignified.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          color: '#1a1a1a',
          background: '#fafafa',
        }}
      >
        {children}
      </body>
    </html>
  );
}
