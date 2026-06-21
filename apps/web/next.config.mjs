import { fileURLToPath } from 'node:url';
import path from 'node:path';

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for Docker/Fly (small runtime image).
  output: 'standalone',
  // Compile the workspace packages (they ship raw TS, not built JS).
  transpilePackages: ['@laal/types', '@laal/supabase'],
  // Pin the workspace root — also where standalone output is rooted.
  outputFileTracingRoot: monorepoRoot,
  // Allow document uploads (death certificates etc.) through server actions.
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
