const PROFANITY_WORDS = [
  "fuck","fucking","fucker","fucked","shit","shitty","bitch","bastard","asshole","dick","pussy","cunt","motherfucker","mf","slut","whore","bullshit","crap","damn",
  "dracu","dracului","naiba","pulă","pula","pizdă","pizda","muie","mă-ta","mă ta","ma-ta","ma ta","mata","morții","mortii","prost","proastă","proasta","idiot","cretin","cretină","cretina","bou","nesimțit","nesimtit","jegos","jegoasă","jegoasa",
];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const WORD_CHARS = "\\p{L}\\p{M}\\p{N}";

export const censorMessageText = (text: string) => {
  let result = text;

  for (const word of PROFANITY_WORDS) {
    const pattern = new RegExp(`(^|[^${WORD_CHARS}])(${escapeRegex(word)})(?=$|[^${WORD_CHARS}])`, "giu");
    result = result.replace(pattern, (match, prefix: string, badWord: string) => `${prefix}${"*".repeat(badWord.length)}`);
  }

  return result;
};