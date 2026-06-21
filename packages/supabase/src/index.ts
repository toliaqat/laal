import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client factories for Ashfaat.
 *
 * - `createBrowserClient` / anon key: use in web + mobile clients. Subject to
 *   Row Level Security.
 * - `createServiceClient` / service-role key: SERVER ONLY (Next.js route
 *   handlers, Edge Functions). Bypasses RLS — never ship to a client bundle.
 */

export type Client = SupabaseClient;

export function createBrowserClient(url: string, anonKey: string): Client {
  if (!url || !anonKey) {
    throw new Error('Supabase URL and anon key are required');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export function createServiceClient(url: string, serviceRoleKey: string): Client {
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase URL and service-role key are required');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export * from '@ashfaat/types';
