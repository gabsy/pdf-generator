/*
  # Add unique constraint to template_files table

  1. Changes
    - Add unique constraint on `section_id` column in `template_files` table
    - This allows upsert operations to work correctly when updating template files
    - Ensures each section can only have one template file

  2. Security
    - No changes to RLS policies needed
    - Existing policies remain in effect
*/

-- Add unique constraint to section_id column
-- This allows the upsert operation in the application to work correctly
ALTER TABLE template_files 
ADD CONSTRAINT template_files_section_id_unique UNIQUE (section_id);