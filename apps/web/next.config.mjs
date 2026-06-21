import { fileURLToPath } from 'node:url';
import path from 'node:path';

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace packages (they ship raw TS, not built JS).
  transpilePackages: ['@ashfaat/types', '@ashfaat/supabase'],
  // Pin the workspace root (a stray lockfile elsewhere would confuse inference).
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
