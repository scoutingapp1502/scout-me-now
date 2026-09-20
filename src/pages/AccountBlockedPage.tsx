import { Ban, ShieldOff, LogOut } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import SportriseWordmark from "@/components/SportriseWordmark";
import type { AccountStatus } from "@/hooks/useAccountStatus";

const CONTACT_EMAIL = "scoutingapp1502@gmail.com";

interface AccountBlockedPageProps {
  status: Exclude<AccountStatus, "active">;
}

// Shown instead of the Dashboard whenever get_my_account_status reports
// anything other than "active" — see
// 20261009090000_account_status_in_app_blocking.sql for why this replaced
// Supabase Auth's ban_duration (that mechanism rejected the login itself,
// before this page could ever be shown). Same visual family as
// MaintenancePage, since both are "explain why the app isn't usable right
// now" screens.
const AccountBlockedPage = ({ status }: AccountBlockedPageProps) => {
  const { lang } = useLanguage();
  const isClosed = status === "closed";

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen w-full bg-gray-100 flex flex-col items-center justify-center px-4 py-10 gap-8">
      <SportriseWordmark className="text-2xl" />

      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8 text-center space-y-3">
        <div className={`mx-auto h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg ${isClosed ? "bg-gradient-to-br from-gray-700 to-gray-900" : "bg-gradient-to-br from-red-600 to-red-800"}`}>
          {isClosed ? <Ban className="h-7 w-7 text-white" /> : <ShieldOff className="h-7 w-7 text-white" />}
        </div>
        <h1 className="font-display text-2xl text-gray-900">
          {isClosed
            ? (lang === "ro" ? "Cont închis definitiv" : "Account permanently closed")
            : (lang === "ro" ? "Cont blocat" : "Account suspended")}
        </h1>
        <p className="text-sm text-gray-500 font-body leading-relaxed">
          {isClosed
            ? (lang === "ro"
                ? "Acest cont a fost închis definitiv pentru încălcarea regulilor platformei."
                : "This account has been permanently closed for violating platform rules.")
            : (lang === "ro"
                ? "Contul tău a fost blocat de un administrator pentru încălcarea regulilor platformei."
                : "Your account has been suspended by an administrator for violating platform rules.")}
        </p>
        {!isClosed && (
          <p className="text-xs text-gray-400 font-body">
            {lang === "ro" ? "Pentru detalii suplimentare, scrie-ne la " : "For more details, email us at "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-gray-600 hover:text-orange-500">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        )}
        <div className="pt-2">
          <Button variant="outline" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {lang === "ro" ? "Deconectare" : "Log out"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccountBlockedPage;
