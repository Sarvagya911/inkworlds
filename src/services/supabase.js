// Creates the Supabase client from environment variables.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = !!(url && key);

// PKCE keeps the OAuth result in ?code=… so it never collides with the #/ router.
export const supabase =
  window.__sbMock ||
  (configured
    ? createClient(url, key, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null);
