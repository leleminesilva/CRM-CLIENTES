import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}
