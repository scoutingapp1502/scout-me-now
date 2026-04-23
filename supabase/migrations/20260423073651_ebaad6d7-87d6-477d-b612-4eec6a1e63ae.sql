CREATE OR REPLACE FUNCTION public.censor_profanity(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  result_text text := COALESCE(input_text, '');
  bad_word text;
  pattern text;
BEGIN
  FOREACH bad_word IN ARRAY ARRAY[
    'fuck','fucking','fucker','fucked','shit','shitty','bitch','bastard','asshole','dick','pussy','cunt','motherfucker','mf','slut','whore','bullshit','crap','damn',
    'dracu','dracului','naiba','pulă','pula','pizdă','pizda','muie','mă-ta','mata','morții','mortii','prost','proastă','proasta','idiot','cretin','cretină','cretina','bou','nesimțit','nesimtit','jegos','jegoasă','jegoasa'
  ] LOOP
    pattern := '(^|[^[:alnum:][:alpha:]])(' || regexp_replace(bad_word, '([\\.\\^\\$\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|\\\\])', '\\\1', 'g') || ')(?=$|[^[:alnum:][:alpha:]])';
    result_text := regexp_replace(
      result_text,
      pattern,
      E'\\1' || repeat('*', char_length(bad_word)),
      'gi'
    );
  END LOOP;

  RETURN result_text;
END;
$$;