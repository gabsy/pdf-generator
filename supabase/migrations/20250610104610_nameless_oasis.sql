/*
  # Create sections and template_files tables

  1. New Tables
    - `sections`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)
      - `template_file_name` (text, nullable)
      - `template_page_count` (integer, nullable)
      - `template_extracted_fields` (jsonb, nullable)
      - `template_uploaded_at` (timestamp, nullable)
      - `users_data` (jsonb, nullable)
      - `field_mappings` (jsonb, nullable)
      - `status` (text, default 'draft')
    
    - `template_files`
      - `id` (uuid, primary key)
      - `section_id` (uuid, references sections)
      - `file_name` (text)
      - `file_data` (text, base64 encoded)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Create sections table
CREATE TABLE IF NOT EXISTS sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_file_name text,
  template_page_count integer,
  template_extracted_fields jsonb,
  template_uploaded_at timestamptz,
  users_data jsonb,
  field_mappings jsonb,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'template-configured', 'users-loaded', 'ready'))
);

-- Create template_files table
CREATE TABLE IF NOT EXISTS template_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES sections(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_data text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_files ENABLE ROW LEVEL SECURITY;

-- Create policies for sections
CREATE POLICY "Users can read own sections"
  ON sections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sections"
  ON sections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sections"
  ON sections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sections"
  ON sections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for template_files
CREATE POLICY "Users can read own template files"
  ON template_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sections 
      WHERE sections.id = template_files.section_id 
      AND sections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own template files"
  ON template_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sections 
      WHERE sections.id = template_files.section_id 
      AND sections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own template files"
  ON template_files
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sections 
      WHERE sections.id = template_files.section_id 
      AND sections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sections 
      WHERE sections.id = template_files.section_id 
      AND sections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own template files"
  ON template_files
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sections 
      WHERE sections.id = template_files.section_id 
      AND sections.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS sections_user_id_idx ON sections(user_id);
CREATE INDEX IF NOT EXISTS sections_created_at_idx ON sections(created_at);
CREATE INDEX IF NOT EXISTS template_files_section_id_idx ON template_files(section_id);