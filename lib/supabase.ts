
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url) {
  throw new Error("Supabase URL is missing!");
}

if (!key) {
  throw new Error("Supabase Publishable Key is missing!");
}

if (!url.startsWith("https://")) {
  throw new Error("Supabase URL must start with https://");
}

export const supabase = createClient(url, key);
