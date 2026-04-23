CREATE OR REPLACE FUNCTION public.censor_profanity(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  result_text text := COALESCE(input_text, '');
  bad_words text[] := ARRAY[
    'fuck','fucking','fucker','fucked','shit','shitty','bitch','bastard','asshole','dick','pussy','cunt','motherfucker','mf','slut','whore','bullshit','crap','damn',
    'dracu','dracului','naiba','pulă','pula','pizdă','pizda','muie','mă-ta','mata','morții','mortii','prost','proastă','proasta','idiot','cretin','cretină','cretina','bou','nesimțit','nesimtit','jegos','jegoasă','jegoasa'
  ];
  replacement_words text[] := ARRAY[
    '****','*******','******','******','****','******','*****','*******','*******','****','*****','****','************','**','****','*****','********','****','****',
    '*****','********','*****','****','*****','*****','****','****','*****','****','******','*******','*****','*****','******','***','********','********','*****','*******','*******'
  ];
  i integer;
BEGIN
  FOR i IN 1..array_length(bad_words, 1) LOOP
    result_text := regexp_replace(
      result_text,
      '(?i)\\m' || regexp_replace(bad_words[i], '([\\.\\^\\$\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|\\-])', '\\\1', 'g') || '\\M',
      replacement_words[i],
      'g'
    );
  END LOOP;

  RETURN result_text;
END;
$$;

CREATE OR REPLACE FUNCTION public.censor_message_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.content := public.censor_profanity(NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS censor_messages_content ON public.messages;

CREATE TRIGGER censor_messages_content
BEFORE INSERT OR UPDATE OF content ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.censor_message_content();