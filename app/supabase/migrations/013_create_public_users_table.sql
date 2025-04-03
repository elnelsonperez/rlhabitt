-- Create a public_users table that mirrors auth.users data
CREATE TABLE public.public_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL
);

-- Add comment to the table
COMMENT ON TABLE public.public_users IS 'Public mirror of auth.users for easy joins with other tables';

-- Update the approved_by reference in communications table
ALTER TABLE communications DROP CONSTRAINT IF EXISTS communications_approved_by_fkey;
ALTER TABLE communications ADD CONSTRAINT communications_approved_by_fkey 
FOREIGN KEY (approved_by) REFERENCES public_users(id);

-- Create function to sync data from auth.users to public_users
CREATE OR REPLACE FUNCTION public.sync_user_to_public()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update the public_users record
  INSERT INTO public.public_users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) 
  DO UPDATE SET email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT/UPDATE on auth.users
CREATE TRIGGER on_auth_user_created_or_updated
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_to_public();

-- Create function to handle deletions
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete from public_users when deleted from auth.users
  DELETE FROM public.public_users
  WHERE id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for DELETE on auth.users
CREATE TRIGGER on_auth_user_deleted
BEFORE DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_deleted_user();

-- Populate existing users
INSERT INTO public.public_users (id, email)
SELECT id, email 
FROM auth.users
ON CONFLICT (id) DO NOTHING;