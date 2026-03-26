-- Jalankan ini di SQL Editor Supabase Anda

-- 1. Pastikan bucket "shop-images" adalah publik
UPDATE storage.buckets SET public = true WHERE id = 'shop-images';

-- 2. Kebijakan agar siapa saja bisa melihat gambar profil toko (SELECT)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'shop-images' );

-- 3. Kebijakan agar pengguna yang sudah login (Authenticated) bisa meng-upload gambar (INSERT)
CREATE POLICY "Authenticated Users can Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( 
    bucket_id = 'shop-images' 
    AND auth.role() = 'authenticated' 
);

-- 4. (Opsional) Kebijakan agar pengguna hanya bisa menghapus/mengupdate gambar milik mereka (berdasarkan owner_id/folder)
-- Karena gambar disimpan dengan format <user.id>-<timestamp>.<ext>, Anda bisa menambahkan validasi,
-- tapi untuk sekarang, kita izinkan UPDATE dan DELETE untuk authenticated user (jika diperlukan oleh fitur edit):
CREATE POLICY "Authenticated Users can Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'shop-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Users can Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'shop-images' AND auth.role() = 'authenticated' );
