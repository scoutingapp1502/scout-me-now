import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";

const NATIONALITIES_EN = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Argentine", "Armenian",
  "Australian", "Austrian", "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian",
  "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese", "Bolivian", "Bosnian",
  "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian",
  "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian",
  "Chilean", "Chinese", "Colombian", "Comorian", "Congolese", "Costa Rican", "Croatian",
  "Cuban", "Cypriot", "Czech", "Danish", "Djiboutian", "Dominican", "Dutch",
  "Ecuadorian", "Egyptian", "Emirati", "English", "Equatorial Guinean", "Eritrean",
  "Estonian", "Ethiopian", "Fijian", "Filipino", "Finnish", "French",
  "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian",
  "Guatemalan", "Guinean", "Guyanese", "Haitian", "Honduran", "Hungarian",
  "Icelandic", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian",
  "Ivorian", "Jamaican", "Japanese", "Jordanian", "Kazakh", "Kenyan", "Kosovar",
  "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese", "Liberian", "Libyan",
  "Lithuanian", "Luxembourgish", "Macedonian", "Malagasy", "Malawian", "Malaysian",
  "Maldivian", "Malian", "Maltese", "Mauritanian", "Mauritian", "Mexican", "Moldovan",
  "Mongolian", "Montenegrin", "Moroccan", "Mozambican", "Namibian", "Nepalese",
  "New Zealander", "Nicaraguan", "Nigerian", "North Korean", "Norwegian",
  "Omani", "Pakistani", "Palestinian", "Panamanian", "Paraguayan", "Peruvian",
  "Polish", "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan",
  "Saudi", "Scottish", "Senegalese", "Serbian", "Singaporean", "Slovak", "Slovenian",
  "Somali", "South African", "South Korean", "Spanish", "Sri Lankan", "Sudanese",
  "Surinamese", "Swedish", "Swiss", "Syrian", "Taiwanese", "Tajik", "Tanzanian",
  "Thai", "Togolese", "Trinidadian", "Tunisian", "Turkish", "Turkmen", "Ugandan",
  "Ukrainian", "Uruguayan", "Uzbek", "Venezuelan", "Vietnamese", "Welsh",
  "Yemeni", "Zambian", "Zimbabwean",
];

const EN_TO_RO: Record<string, string> = {
  "Afghan": "Afgan", "Albanian": "Albanez", "Algerian": "Algerian", "American": "American",
  "Andorran": "Andorran", "Angolan": "Angolan", "Argentine": "Argentinian", "Armenian": "Armean",
  "Australian": "Australian", "Austrian": "Austriac", "Azerbaijani": "Azer", "Bahamian": "Bahamez",
  "Bahraini": "Bahrainez", "Bangladeshi": "Bangladeș", "Barbadian": "Barbadian",
  "Belarusian": "Bielorus", "Belgian": "Belgian", "Belizean": "Belizan", "Beninese": "Beninez",
  "Bhutanese": "Bhutanez", "Bolivian": "Bolivian", "Bosnian": "Bosniac",
  "Brazilian": "Brazilian", "British": "Britanic", "Bruneian": "Bruneian", "Bulgarian": "Bulgar",
  "Burkinabe": "Burkinabez", "Burmese": "Birman", "Burundian": "Burundez",
  "Cambodian": "Cambodgian", "Cameroonian": "Camerunez", "Canadian": "Canadian",
  "Cape Verdean": "Capverdian", "Central African": "Centrafican", "Chadian": "Ciadian",
  "Chilean": "Chilean", "Chinese": "Chinez", "Colombian": "Colombian", "Comorian": "Comorian",
  "Congolese": "Congolez", "Costa Rican": "Costarican", "Croatian": "Croat",
  "Cuban": "Cuban", "Cypriot": "Cipriot", "Czech": "Ceh", "Danish": "Danez",
  "Djiboutian": "Djiboutian", "Dominican": "Dominican", "Dutch": "Olandez",
  "Ecuadorian": "Ecuadorian", "Egyptian": "Egiptean", "Emirati": "Emiratez",
  "English": "Englez", "Equatorial Guinean": "Guinean Ecuatorial", "Eritrean": "Eritrean",
  "Estonian": "Eston", "Ethiopian": "Etiopian", "Fijian": "Fijian", "Filipino": "Filipino",
  "Finnish": "Finlandez", "French": "Francez",
  "Gabonese": "Gabonez", "Gambian": "Gambian", "Georgian": "Georgian", "German": "German",
  "Ghanaian": "Ghanez", "Greek": "Grec", "Grenadian": "Grenadian",
  "Guatemalan": "Guatemalez", "Guinean": "Guinean", "Guyanese": "Guyanez",
  "Haitian": "Haitian", "Honduran": "Hondurian", "Hungarian": "Maghiar",
  "Icelandic": "Islandez", "Indian": "Indian", "Indonesian": "Indonezian",
  "Iranian": "Iranian", "Iraqi": "Irakian", "Irish": "Irlandez", "Israeli": "Israelian",
  "Italian": "Italian", "Ivorian": "Ivorian", "Jamaican": "Jamaican", "Japanese": "Japonez",
  "Jordanian": "Iordanian", "Kazakh": "Kazah", "Kenyan": "Kenyan", "Kosovar": "Kosovar",
  "Kuwaiti": "Kuweitian", "Kyrgyz": "Kârgâz", "Laotian": "Laoțian", "Latvian": "Leton",
  "Lebanese": "Libanez", "Liberian": "Liberian", "Libyan": "Libian",
  "Lithuanian": "Lituanian", "Luxembourgish": "Luxemburghez", "Macedonian": "Macedonean",
  "Malagasy": "Malgaș", "Malawian": "Malawian", "Malaysian": "Malaezan",
  "Maldivian": "Maldivian", "Malian": "Malian", "Maltese": "Maltez",
  "Mauritanian": "Mauritan", "Mauritian": "Mauritian", "Mexican": "Mexican",
  "Moldovan": "Moldovean", "Mongolian": "Mongol", "Montenegrin": "Muntenegrean",
  "Moroccan": "Marocan", "Mozambican": "Mozambican", "Namibian": "Namibian",
  "Nepalese": "Nepalez", "New Zealander": "Neozeelandez", "Nicaraguan": "Nicaraguan",
  "Nigerian": "Nigerian", "North Korean": "Nord-Coreean", "Norwegian": "Norvegian",
  "Omani": "Omanez", "Pakistani": "Pakistani", "Palestinian": "Palestinian",
  "Panamanian": "Panamez", "Paraguayan": "Paraguayan", "Peruvian": "Peruan",
  "Polish": "Polonez", "Portuguese": "Portughez", "Qatari": "Qatarez",
  "Romanian": "Român", "Russian": "Rus", "Rwandan": "Rwandez",
  "Saudi": "Saudit", "Scottish": "Scoțian", "Senegalese": "Senegalez",
  "Serbian": "Sârb", "Singaporean": "Singaporean", "Slovak": "Slovac", "Slovenian": "Sloven",
  "Somali": "Somalez", "South African": "Sud-African", "South Korean": "Sud-Coreean",
  "Spanish": "Spaniol", "Sri Lankan": "Srilankez", "Sudanese": "Sudanez",
  "Surinamese": "Surinamez", "Swedish": "Suedez", "Swiss": "Elvețian",
  "Syrian": "Sirian", "Taiwanese": "Taiwanez", "Tajik": "Tadjic", "Tanzanian": "Tanzanian",
  "Thai": "Tailandez", "Togolese": "Togolez", "Trinidadian": "Trinidadian",
  "Tunisian": "Tunisian", "Turkish": "Turc", "Turkmen": "Turkmen", "Ugandan": "Ugandez",
  "Ukrainian": "Ucrainean", "Uruguayan": "Uruguayan", "Uzbek": "Uzbek",
  "Venezuelan": "Venezuelan", "Vietnamese": "Vietnamez", "Welsh": "Galez",
  "Yemeni": "Yemenit", "Zambian": "Zambian", "Zimbabwean": "Zimbabwean",
};

// Reverse map for RO → EN lookup
const RO_TO_EN: Record<string, string> = {};
for (const [en, ro] of Object.entries(EN_TO_RO)) {
  RO_TO_EN[ro.toLowerCase()] = en;
}

export function getDisplayNationality(enValue: string | null | undefined, lang: "ro" | "en"): string {
  if (!enValue) return "";
  if (lang === "ro") return EN_TO_RO[enValue] || enValue;
  return enValue;
}

interface NationalityInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const NationalityInput = ({ value, onChange, placeholder, className }: NationalityInputProps) => {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [filtered, setFiltered] = useState<{ en: string; display: string }[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { lang } = useLanguage();

  // Sync display text when value (EN) changes externally
  useEffect(() => {
    if (value) {
      setInputText(lang === "ro" ? (EN_TO_RO[value] || value) : value);
    } else {
      setInputText("");
    }
  }, [value, lang]);

  useEffect(() => {
    if (inputText && inputText.length > 0) {
      const lower = inputText.toLowerCase();
      const results = NATIONALITIES_EN
        .map((en) => ({ en, display: lang === "ro" ? (EN_TO_RO[en] || en) : en }))
        .filter((item) => item.display.toLowerCase().includes(lower))
        .slice(0, 8);
      setFiltered(results);
    } else {
      setFiltered([]);
    }
  }, [inputText, lang]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value);
          setOpen(true);
          // If user clears the input, clear the value
          if (!e.target.value) onChange("");
        }}
        onFocus={() => inputText && setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item.en}
              type="button"
              onClick={() => {
                onChange(item.en); // Always save English value
                setInputText(item.display);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
            >
              {item.display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NationalityInput;
