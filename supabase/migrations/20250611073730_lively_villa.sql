/*
  # Fix unique constraint for template_files table
  
  This migration checks if the constraint already exists before trying to add it,
  which prevents the "relation already exists" error.
*/

-- Check if the constraint already exists and only add it if it doesn't
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'template_files_section_id_unique' 
    AND conrelid = 'template_files'::regclass
  ) THEN
    -- Add the constraint if it doesn't exist
    ALTER TABLE template_files 
    ADD CONSTRAINT template_files_section_id_unique UNIQUE (section_id);
  END IF;
END $$;