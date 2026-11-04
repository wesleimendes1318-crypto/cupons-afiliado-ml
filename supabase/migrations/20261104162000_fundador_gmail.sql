-- Weslei, 04/11/2026 (decision card): also allow his Gmail as founder while
-- melhorescolha.io is not verified in Resend (codes only reach the Resend
-- account owner, the Gmail). Applied directly 16:21 UTC.
CREATE OR REPLACE FUNCTION public.eh_fundador()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) IN ('wes_lei18@hotmail.com', 'weslei.mendes1318@gmail.com')
      AND u.email_confirmed_at IS NOT NULL
  );
$function$;
