import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoClient } from "./demoClient";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const isConfigured = url.startsWith("https://") && anonKey.length > 20 && !url.includes("TU_PROYECTO");

const liveClient = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabase = (liveClient ?? demoClient) as SupabaseClient;
