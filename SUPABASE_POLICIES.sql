-- ============================================
-- SUPABASE STORAGE RLS POLICIES
-- Para bucket: group-files
-- ============================================

-- POLÍTICA 1: Usuarios ven solo archivos de sus grupos
CREATE POLICY "Users see only their group files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'group-files' 
  AND (
    path_tokens[1]::uuid = (
      SELECT id FROM groups 
      WHERE members @> jsonb_build_array(auth.uid())
    )
  )
);

-- POLÍTICA 2: Usuarios suben archivos solo en sus grupos
CREATE POLICY "Users upload only to their groups"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'group-files'
  AND (
    path_tokens[1]::uuid = (
      SELECT id FROM groups 
      WHERE members @> jsonb_build_array(auth.uid())
    )
  )
);

-- POLÍTICA 3: Solo líderes pueden eliminar archivos
CREATE POLICY "Only leaders can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'group-files'
  AND (
    path_tokens[1]::uuid = (
      SELECT id FROM groups 
      WHERE leaderId = auth.uid()
    )
  )
);
