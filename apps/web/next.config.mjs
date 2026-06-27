import { fileURLToPath } from 'node:url';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Point next-intl at our request config (messages + locale resolution).
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for Docker/Fly (small runtime image).
  output: 'standalone',
  // Compile the workspace packages (they ship raw TS, not built JS).
  transpilePackages: ['@laal/types', '@laal/supabase', '@laal/i18n'],
  // Pin the workspace root — also where standalone output is rooted.
  outputFileTracingRoot: monorepoRoot,
  // Allow document uploads (death certificates etc.) through server actions.
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default withNextIntl(nextConfig);
