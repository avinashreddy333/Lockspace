-- Create table for encrypted workspaces
CREATE TABLE public.encrypted_workspaces (
  id TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  metadata_iv TEXT NOT NULL,
  metadata_ciphertext TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Create table for encrypted folders
CREATE TABLE public.encrypted_folders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.encrypted_workspaces(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  metadata_iv TEXT NOT NULL,
  metadata_ciphertext TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Create table for encrypted files
CREATE TABLE public.encrypted_files (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES public.encrypted_folders(id) ON DELETE CASCADE,
  metadata_iv TEXT NOT NULL,
  metadata_ciphertext TEXT NOT NULL,
  content_iv TEXT NOT NULL,
  content_ciphertext TEXT NOT NULL,
  content_wrapped_key TEXT NOT NULL,
  content_key_iv TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Enable RLS
ALTER TABLE public.encrypted_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_files ENABLE ROW LEVEL SECURITY;

-- Allow public access (zero-knowledge: data is encrypted, security comes from encryption)
CREATE POLICY "Allow public read" ON public.encrypted_workspaces FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.encrypted_workspaces FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read" ON public.encrypted_folders FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.encrypted_folders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.encrypted_folders FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON public.encrypted_files FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.encrypted_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.encrypted_files FOR DELETE USING (true);

-- Create indexes
CREATE INDEX idx_folders_workspace ON public.encrypted_folders(workspace_id);
CREATE INDEX idx_files_folder ON public.encrypted_files(folder_id);