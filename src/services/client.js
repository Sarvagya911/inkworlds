// Shared Supabase client guard and error unwrapping.
import { supabase } from './supabase.js';

export const sb = () => {
  if (!supabase) throw { code: 'not_configured', message: 'Supabase is not configured' };
  return supabase;
};

export const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};
