import { useEffect, useRef, useState } from "react";
import { Bot, X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface KbEntry {
  keywords: string[];
  answer: string;
}

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");
const normalize = (s: string) =>
  s.normalize("NFD").replace(DIACRITICS_REGEX, "").toLowerCase();

// Keyword-matched knowledge base — no external AI call, answers are fixed.
const KB: KbEntry[] = [
  {
    keywords: ["completez profil pas cu pas", "completez profilul", "de unde incep profilul", "cum imi construiesc profilul", "pas cu pas"],
    answer: "Pasul 1: Poza de profil — apasă creionul ✎ de pe cardul de sus.\nPasul 2: Date personale — nume, poziție, naționalitate, dată naștere, din tab-ul Profil.\nPasul 3: Date fizice — înălțime, greutate, picior preferat.\nPasul 4: Carieră — echipele pe care le-ai avut.\nPasul 5: Tab-ul Teste — filmează-te la testele tehnice/atletice.\nPasul 6: Tab-ul Video — adaugă highlights.\nPasul 7: Agent, dacă ai.\n\nAi și un ghid „Construiește-ți profilul” care apare automat și te duce direct la ce mai lipsește.",
  },
  {
    keywords: ["edita profil", "editez profil", "modific profil", "schimb profil", "editare profil"],
    answer: "Ca să editezi orice secțiune a profilului, apasă pe creionul ✎ din colțul acelei secțiuni (header, date fizice, agent, etc.), fă modificările, apoi apasă butonul portocaliu „Salvați”.",
  },
  {
    keywords: ["poza de profil", "poza profil", "fotografie profil", "schimb poza", "repozitionez poza", "trag poza", "muta poza"],
    answer: "Poza de profil se schimbă din creionul ✎ de pe cardul de sus (mod editare) — apasă pe cameră ca să încarci alta. Cât ești în editare, poți și să tragi poza cu mouse-ul (sus/jos/stânga/dreapta) în interiorul cadrului, ca să alegi ce parte se vede.",
  },
  {
    keywords: ["video highlight", "adaug video", "incarc video", "clip video", "moment din meci"],
    answer: "Din Personal Profile → tab-ul „Video”, poți adăuga un link YouTube sau încărca direct un fișier video (max 100MB) cu cele mai bune momente. Se salvează cu butonul „Salvați” de sub listă.",
  },
  {
    keywords: ["test tehnic", "test atletic", "teste", "cum fac testul", "exemplu video test"],
    answer: "În tab-ul „Teste” din Personal Profile găsești testele specifice sportului tău, fiecare cu un exemplu video. Te filmezi făcând testul și încarci propriul clip acolo.",
  },
  {
    keywords: ["postare", "postez", "sterg postare", "sterg o postare", "adaug postare", "stiri"],
    answer: "Din tab-ul „Postări” poți scrie o postare nouă din caseta de sus (poză, videoclip sau text). Postările tale apar într-o grilă mai jos — click pe oricare o deschide, iar de acolo o poți șterge din meniul „...”.",
  },
  {
    keywords: ["urmaresc", "urmarire", "follow", "accept cerere", "cerere de urmarire"],
    answer: "Poți trimite o cerere de urmărire de pe profilul altui utilizator (din Comunitate). Cererile primite se acceptă/resping din secțiunea „Notificări”.",
  },
  {
    keywords: ["notificari", "clopotel"],
    answer: "Secțiunea „Notificări” din sidebar arată cererile de urmărire, aprecierile și video-urile noi de la jucătorii pe care îi urmărești. Numărul de lângă clopoțel arată câte sunt necitite.",
  },
  {
    keywords: ["activitate", "feed"],
    answer: "„Activitate” e feed-ul tău — postările persoanelor pe care le urmărești, actualizate live. Arată doar postările apărute după ce ți-au acceptat cererea de urmărire, nu tot istoricul lor.",
  },
  {
    keywords: ["comunitate", "caut jucatori", "caut scouteri", "descoper jucatori", "filtrez"],
    answer: "Din „Comunitate” poți căuta și filtra jucători sau scouteri după sport, poziție, naționalitate, vârstă etc. Fiecare card are un buton de urmărire.",
  },
  {
    keywords: ["mesaj", "conversatie", "grup de discutie", "trimit mesaj"],
    answer: "Din „Mesaje” poți deschide o conversație individuală sau crea un grup. Poți trimite și atașamente foto/video.",
  },
  {
    keywords: ["notite", "raport jucator", "notite despre jucatori"],
    answer: "Secțiunea „Notițe” (vizibilă doar la conturile de Descoperitor/scout) e locul unde salvezi notițe și rapoarte private despre jucătorii pe care îi urmărești — vizibile doar ție.",
  },
  {
    keywords: ["logo club", "logo echipa", "sigla club"],
    answer: "Logo-ul clubului apare automat pe cardul de profil DOAR dacă numele echipei scrise la profil se potrivește exact (fără diacritice/majuscule) cu un club adăugat de administrator.",
  },
  {
    keywords: ["streak", "foc", "zile consecutive"],
    answer: "Iconița de foc 🔥 de lângă numele tău arată câte zile consecutive te-ai logat în aplicație. Menținerea streak-ului deblochează teste noi.",
  },
  {
    keywords: ["sterg contul", "dezactivez contul", "confidentialitate cont"],
    answer: "Opțiunile de confidențialitate și ștergere a contului se găsesc în Setări → Confidențialitate cont, jos în sidebar.",
  },
  {
    keywords: ["blochez", "blocare", "utilizator blocat"],
    answer: "Poți bloca pe cineva din Setări → Utilizatori blocați, sau direct din meniul „...” de pe profilul acelei persoane.",
  },
  {
    keywords: ["mod somn", "opresc notificari", "pauza notificari"],
    answer: "„Mod Somn” din Setări îți permite să oprești temporar notificările, fără să te delogezi.",
  },
  {
    keywords: ["schimb limba", "limba aplicatie", "engleza", "romana"],
    answer: "Limba aplicației se schimbă din butonul RO/ENG aflat jos în sidebar, sub secțiunile principale.",
  },
  {
    keywords: ["cariera", "echipa noua", "an inceput", "an sfarsit", "adaug echipa"],
    answer: "În Personal Profile → Profil → Carieră, apeși „+” ca să adaugi o echipă nouă. Se cere doar anul de început și de sfârșit (nu ziua exactă) — mulți nu-și amintesc data precisă.",
  },
  {
    keywords: ["agent", "contact agent"],
    answer: "Datele agentului se completează din secțiunea „Agent” a tab-ului Profil — nume, email, telefon.",
  },
  {
    keywords: ["diferenta jucator scouter", "cont descoperitor", "tip de cont"],
    answer: "Există două tipuri de cont: „Jucător” (își construiește profilul cu teste/video/carieră) și „Descoperitor” (scouter — caută, urmărește și notează jucători).",
  },
  {
    keywords: ["arhiva", "sterse recent", "recuperez"],
    answer: "Elementele arhivate sau șterse recent se găsesc în Setări → Arhivă, respectiv Setări → Elemente șterse recent.",
  },
  {
    keywords: ["favorite", "salvez jucator"],
    answer: "Poți marca pe cineva favorit din meniul „...” de pe profilul lui — apare apoi în Setări → Favorite, și postările lui apar primele în Activitate.",
  },
  {
    keywords: ["recomandare", "trimit recomandare"],
    answer: "Recomandările se trimit din secțiunea „Recomandări” a profilului (tab-ul Profil) — poți scrie o recomandare pentru cineva sau vedea recomandările primite.",
  },
  {
    keywords: ["salut", "buna", "hello", "hei"],
    answer: "Salut! Sunt asistentul Sportrise — întreabă-mă orice despre cum funcționează aplicația (unde găsești ceva, cum adaugi/modifici/ștergi o secțiune).",
  },
];

const FALLBACK = "Nu sunt sigur ce înseamnă asta. Încearcă să reformulezi mai simplu (ex: „cum adaug un video”, „cum șterg o postare”), sau caută în Setări → Ajutor.";

const findAnswer = (question: string): string => {
  const q = normalize(question);
  let best: { entry: KbEntry; score: number } | null = null;
  for (const entry of KB) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(normalize(kw))) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best ? best.entry.answer : FALLBACK;
};

const SUGGESTIONS = [
  "Cum adaug un video?",
  "Cum șterg o postare?",
  "Ce e secțiunea Activitate?",
  "Cum urmăresc pe cineva?",
  "Cum îmi completez profilul pas cu pas?",
];

const AppAssistant = () => {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", text: "Salut! Sunt asistentul Sportrise. Întreabă-mă orice despre cum funcționează aplicația." }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text) return;
    const answer = findAnswer(text);
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", text: answer }]);
    setInput("");
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[320px] max-w-[calc(100vw-32px)] h-[420px] max-h-[70vh] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="font-display text-sm tracking-wide uppercase">Asistent Sportrise</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white transition-colors" aria-label={lang === "ro" ? "Închide" : "Close"}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm"
                      : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="text-[11px] px-2.5 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex items-center gap-2 p-2.5 border-t border-gray-200 bg-white shrink-0"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === "ro" ? "Scrie o întrebare..." : "Type a question..."}
              className="flex-1 h-9 text-xs bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0 bg-orange-500 hover:bg-orange-600 text-white">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
        aria-label={lang === "ro" ? "Asistent Sportrise" : "Sportrise Assistant"}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </div>
  );
};

export default AppAssistant;
