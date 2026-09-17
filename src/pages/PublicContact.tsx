import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Clock, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import SportriseWordmark from "@/components/SportriseWordmark";

const CONTACT_EMAIL = "scoutingapp1502@gmail.com";

const PublicContact = () => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !message.trim()) {
      toast({
        title: lang === "ro" ? "Completează câmpurile obligatorii" : "Fill in the required fields",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).from("public_contact_messages").insert({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      email: email.trim(),
      message: message.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast({
        title: lang === "ro" ? "Nu s-a putut trimite mesajul" : "Couldn't send your message",
        description: lang === "ro" ? "Încearcă din nou sau scrie-ne direct pe email." : "Please try again, or email us directly.",
        variant: "destructive",
      });
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <SportriseWordmark className="text-lg" />
          </Link>
          <Link to="/auth?tab=register" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600 font-body transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {lang === "ro" ? "Înapoi" : "Back"}
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Left: copy */}
        <div>
          <span className="text-orange-500 text-xs font-body font-bold tracking-widest uppercase">// CONTACT</span>
          <h1 className="font-display text-3xl sm:text-5xl text-gray-900 mt-8 mb-5 leading-tight">
            {lang === "ro" ? (
              <>ÎȚI RĂSPUNDEM <span className="text-orange-500">CU PLĂCERE!</span></>
            ) : (
              <>WE'LL GET BACK <span className="text-orange-500">TO YOU!</span></>
            )}
          </h1>
          <p className="text-gray-500 font-body leading-relaxed mb-4">
            {lang === "ro"
              ? "Echipa SportRise e aici pentru tine. Completează formularul pentru întrebări despre cont, sesizări legate de siguranță, solicitări privind datele tale personale sau orice altceva."
              : "The SportRise team is here for you. Fill in the form for account questions, safety reports, requests about your personal data, or anything else."}
          </p>

          <div className="flex items-center gap-2 mt-6">
            <Mail className="h-4 w-4 text-orange-500 shrink-0" />
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-gray-900 font-semibold font-body hover:text-orange-600 transition-colors">
              {CONTACT_EMAIL}
            </a>
          </div>
          <div className="flex items-center gap-2 mt-2 text-gray-400 text-sm font-body">
            <Clock className="h-4 w-4 shrink-0" />
            {lang === "ro" ? "De obicei răspundem în 24 de ore." : "We usually respond within 24 hours."}
          </div>
        </div>

        {/* Right: form */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8">
          {submitted ? (
            <div className="flex flex-col items-center text-center py-8">
              <CheckCircle2 className="h-14 w-14 text-orange-500 mb-3" />
              <p className="font-display text-xl text-gray-900 mb-1">
                {lang === "ro" ? "Mesajul a fost trimis!" : "Message sent!"}
              </p>
              <p className="text-gray-500 font-body text-sm">
                {lang === "ro" ? "Îți răspundem cât mai curând posibil." : "We'll get back to you as soon as possible."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-700 font-body mb-1 block">
                  {lang === "ro" ? "Nume complet" : "Full Name"}
                </label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="bg-white" />
              </div>
              <div>
                <label className="text-sm text-gray-700 font-body mb-1 block">
                  {lang === "ro" ? "Număr de telefon (opțional)" : "Phone Number (optional)"}
                </label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-white" />
              </div>
              <div>
                <label className="text-sm text-gray-700 font-body mb-1 block">
                  {lang === "ro" ? "Adresă de email" : "Email Address"}
                </label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white" />
              </div>
              <div>
                <label className="text-sm text-gray-700 font-body mb-1 block">
                  {lang === "ro" ? "Mesajul tău" : "Your message"}
                </label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={5} className="bg-white" />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-5 rounded-xl"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === "ro" ? "Trimite" : "Send")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicContact;
