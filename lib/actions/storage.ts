// Client-side file upload helper
// Note: File uploads should be done client-side using the Supabase client
// This helper function is for use in client components

export async function uploadFileClient(
  supabase: any,
  file: File,
  path: string
): Promise<string> {
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = `${path}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('receipts')
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    // If RLS error, provide helpful message
    if (error.message?.includes('row-level security') || error.message?.includes('RLS') || error.code === '42501') {
      throw new Error(
        'Storage upload blocked by security policy. Please run migration 022_complete_upload_fix.sql in Supabase SQL Editor to fix this.'
      );
    }
    
    // If bucket doesn't exist, provide helpful error message
    if (error.message?.includes('Bucket not found') || error.message?.includes('bucket') || error.code === '404') {
      throw new Error(
        'Storage bucket "receipts" not found. Please create it in Supabase Dashboard:\n' +
        '1. Go to Storage in Supabase Dashboard\n' +
        '2. Click "New bucket"\n' +
        '3. Name it: receipts\n' +
        '4. Make it Public\n' +
        '5. Click "Create bucket"'
      );
    }
    
    // If file already exists, try with a different name
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      const retryFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const retryPath = `${path}/${retryFileName}`;
      const { data: retryData, error: retryError } = await supabase.storage
        .from('receipts')
        .upload(retryPath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });
      
      if (retryError) throw retryError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(retryData.path);
      
      return publicUrl;
    }
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('receipts')
    .getPublicUrl(data.path);

  return publicUrl;
}
