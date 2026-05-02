import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars: " + supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);