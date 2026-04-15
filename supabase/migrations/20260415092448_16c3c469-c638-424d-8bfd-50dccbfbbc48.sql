
CREATE OR REPLACE FUNCTION public.search_agents(search_term text)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  photo_url text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sp.user_id,
    sp.first_name,
    sp.last_name,
    sp.photo_url,
    au.email
  FROM public.scout_profiles sp
  INNER JOIN public.user_roles ur ON ur.user_id = sp.user_id AND ur.role = 'agent'
  INNER JOIN auth.users au ON au.id = sp.user_id
  WHERE 
    (sp.first_name || ' ' || sp.last_name) ILIKE '%' || search_term || '%'
  ORDER BY sp.first_name, sp.last_name
  LIMIT 10
$$;
