import type { Language, TranslationKeys } from "@/i18n/translations";

const footballPositionTranslations: Record<string, Partial<Record<Language, string>>> = {
  "Portar": { en: "Goalkeeper", de: "Torwart", fr: "Gardien", es: "Portero", it: "Portiere" },
  "Fundaș Central": { en: "Centre Back", de: "Innenverteidiger", fr: "Défenseur central", es: "Defensa central", it: "Difensore centrale" },
  "Fundaș Dreapta": { en: "Right Back", de: "Rechtsverteidiger", fr: "Arrière droit", es: "Lateral derecho", it: "Terzino destro" },
  "Fundaș Stânga": { en: "Left Back", de: "Linksverteidiger", fr: "Arrière gauche", es: "Lateral izquierdo", it: "Terzino sinistro" },
  "Mijlocaș Defensiv": { en: "Defensive Midfielder", de: "Defensives Mittelfeld", fr: "Milieu défensif", es: "Centrocampista defensivo", it: "Centrocampista difensivo" },
  "Mijlocaș Central": { en: "Central Midfielder", de: "Zentrales Mittelfeld", fr: "Milieu central", es: "Centrocampista", it: "Centrocampista centrale" },
  "Mijlocaș Ofensiv": { en: "Attacking Midfielder", de: "Offensives Mittelfeld", fr: "Milieu offensif", es: "Centrocampista ofensivo", it: "Centrocampista offensivo" },
  "Extremă Dreapta": { en: "Right Winger", de: "Rechtsaußen", fr: "Ailier droit", es: "Extremo derecho", it: "Ala destra" },
  "Extremă Stânga": { en: "Left Winger", de: "Linksaußen", fr: "Ailier gauche", es: "Extremo izquierdo", it: "Ala sinistra" },
  "Atacant": { en: "Striker", de: "Stürmer", fr: "Attaquant", es: "Delantero", it: "Attaccante" },
  "Atacant Fals": { en: "False Nine", de: "Falsche Neun", fr: "Faux numéro 9", es: "Falso nueve", it: "Falso nove" },
};

export function translatePosition(position: string | null | undefined, lang: Language): string {
  if (!position) return "";
  if (lang === "ro") return position;
  return footballPositionTranslations[position]?.[lang] ?? position;
}

export function translateFootHandValue(value: string | null | undefined, isBasketball: boolean, t: TranslationKeys): string | null {
  if (!value) return null;
  if (isBasketball) {
    if (value === "Dreapta") return t.dashboard.profile.rightHand;
    if (value === "Stânga") return t.dashboard.profile.leftHand;
    if (value === "Ambele") return t.dashboard.profile.bothHands;
  } else {
    if (value === "Drept") return t.dashboard.profile.rightFoot;
    if (value === "Stâng") return t.dashboard.profile.leftFoot;
    if (value === "Ambele") return t.dashboard.profile.bothFeet;
  }
  return value;
}
