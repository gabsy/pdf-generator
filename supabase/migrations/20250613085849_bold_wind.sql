/*
  # Add unique constraint to template_files table (safe version)

  1. Changes
    - Add unique constraint on `section_id` column in `template_files` table
    - This allows upsert operations to work correctly when updating template files
    - Ensures each section can only have one template file
    - Uses IF NOT EXISTS logic to avoid errors if constraint already exists

  2. Security
    - No changes to RLS policies needed
    - Existing policies remain in effect
*/

-- Add unique constraint to section_id column only if it doesn't already exist
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