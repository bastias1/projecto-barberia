# Storage Configuration for Avatars

## Setup Instructions

1. **Go to Supabase Dashboard** → Storage → Your `imgs` bucket

2. **Create avatars folder**
   - Click "Create Folder"
   - Name: `avatars`

3. **Set Bucket Policies** (if not already public)
   
   In SQL Editor, run:
   ```sql
   -- Allow public read access to avatars
   CREATE POLICY "Public avatar read access"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'avatars');

   -- Allow authenticated users to upload their own avatar
   CREATE POLICY "Users can upload avatar"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'avatars' AND auth.role() = 'authenticated');

   -- Allow users to update their own avatar
   CREATE POLICY "Users can update own avatar"
   ON storage.objects FOR UPDATE
   USING (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'avatars' AND auth.role() = 'authenticated');

   -- Allow users to delete their own avatar
   CREATE POLICY "Users can delete own avatar"
   ON storage.objects FOR DELETE
   USING (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'avatars' AND auth.role() = 'authenticated');
   ```

## Usage

The avatar upload component will:
- Upload images to `imgs/avatars/{userId}-{random}.{ext}`
- Update the `usuario.profile_image` field with the public URL
- Display a preview immediately after upload
- Show user initials as fallback when no image exists

## Current Structure

```
imgs/
├── logo/
│   ├── BLACK.png
│   └── WHITE.png
├── cortes/
│   ├── cut1.png
│   ├── cut2.png
│   └── ...
└── avatars/          ← New folder for profile pictures
    └── {userId}-{random}.{ext}
```
