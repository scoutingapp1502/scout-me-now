const PROFANITY_WORDS = [
  "fuck","fucking","fucker","fucked","shit","shitty","bitch","bastard","asshole","dick","pussy","cunt","motherfucker","mf","slut","whore","bullshit","crap","damn",
  "dracu","dracului","naiba","pulă","pula","pizdă","pizda","muie","mă-ta","mata","morții","mortii","prost","proastă","proasta","idiot","cretin","cretină","cretina","bou","nesimțit","nesimtit","jegos","jegoasă","jegoasa",
];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

export const censorMessageText = (text: string) => {
  let result = text;

  for (const word of PROFANITY_WORDS) {
    result = result.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, "giu"), (match) => "*".repeat(match.length));
  }

  return result;
};