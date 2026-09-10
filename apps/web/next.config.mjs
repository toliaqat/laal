import { fileURLToPath } from 'node:url';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Point next-intl at our request config (messages + locale resolution).
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/**
 * Hosts next/image is allowed to optimize. Cover images live in the public R2
 * bucket, served from R2_PUBLIC_BASE_URL (see apps/web/lib/r2.ts). We read that
 * env var so self-hosters don't have to edit this file, and keep the two
 * shipped defaults (the custom domain from .env.example, plus R2's own
 * *.r2.dev origin) so builds without the var still render covers.
 */
function coverImageHosts() {
  const patterns = [
    { protocol: 'https', hostname: 'img.laal.app' },
    { protocol: 'https', hostname: '**.r2.dev' },
  ];
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (base) {
    try {
      const { protocol, hostname } = new URL(base);
      const scheme = protocol.replace(':', '');
      if (!patterns.some((p) => p.hostname === hostname && p.protocol === scheme)) {
        patterns.push({ protocol: scheme, hostname });
      }
    } catch {
      // Malformed value — fall back to the defaults rather than failing the build.
    }
  }
  return patterns;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for Docker/Fly (small runtime image).
  output: 'standalone',
  // Compile the workspace packages (they ship raw TS, not built JS).
  transpilePackages: ['@laal/types', '@laal/supabase', '@laal/i18n'],
  // Pin the workspace root — also where standalone output is rooted.
  outputFileTracingRoot: monorepoRoot,
  images: { remotePatterns: coverImageHosts() },
  // Allow document uploads (death certificates etc.) through server actions.
  experimental: {
    // Above the 20MB app-level file caps so our friendly validation message
    // fires before the framework rejects the request body outright.
    serverActions: { bodySizeLimit: '25mb' },
  },
};

// Sentry wraps last. Source-map upload stays off until CI has an auth token;
// server stack traces are still readable without it.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  sourcemaps: { disable: true },
  telemetry: false,
});
