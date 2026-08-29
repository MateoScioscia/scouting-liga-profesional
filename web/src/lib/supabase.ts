import { createClient } from "@supabase/supabase-js";

// Fallbacks al proyecto Supabase público de esta app (la anon key está pensada
// para exponerse en el cliente). Se pueden overridear con variables de entorno
// en Vercel si en algún momento se apunta a otro proyecto de Supabase.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iktpsyexxbwiuklkwhyi.supabase.co";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdHBzeWV4eGJ3aXVrbGt3aHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDY0NzksImV4cCI6MjEwMzU4MjQ3OX0.pN4QImwGy3e7JRNiwE_IcXOMH7t6OijssGRMgjtbrug";

export function getSupabase() {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
