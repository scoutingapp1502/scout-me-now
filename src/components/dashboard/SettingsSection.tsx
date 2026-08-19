import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  Bookmark, Archive, Activity, Bell, Timer, Lock, Star,
  Ban, MessageCircle, MessageSquare, Share2, AlertOctagon,
  EyeOff, UserPlus, Heart, VolumeX, LayoutGrid, Film,
  Languages, HelpCircle, Shield, Info,
  ChevronRight, Trash2, LogOut, UserCheck, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

interface SettingsSectionProps {
  userId: string;
  userRole: "player" | "cauta_jucator" | null;
  onNavigate?: (section: string) => void;
}

type SettingsItem = {
  icon: React.ElementType;
  labelRo: string;
  labelEn: string;
  value?: string;
  action?: "soon" | "password" | "delete" | "logout";
  navigateTo?: string;
};

type SettingsGroup = {
  titleRo: string;
  titleEn: string;
  items: SettingsItem[];
};

const groups: SettingsGroup[] = [
  {
    titleRo: "Cum folosești SportRise",
    titleEn: "How you use SportRise",
    items: [
      { icon: Bookmark,  labelRo: "Salvat",                   labelEn: "Saved",                navigateTo: "saved" },
      { icon: Archive,   labelRo: "Arhivă",                   labelEn: "Archive",              navigateTo: "archive" },
      { icon: Activity,  labelRo: "Activitatea ta",           labelEn: "Your activity",        navigateTo: "your-activity" },
      { icon: Bell,      labelRo: "Notificări",               labelEn: "Notifications",        navigateTo: "notification-settings" },
      { icon: Timer,     labelRo: "Gestionarea timpului",     labelEn: "Time management",      navigateTo: "time-management" },
    ],
  },
  {
    titleRo: "Cine îți poate vedea conținutul",
    titleEn: "Who can see your content",
    items: [
      { icon: Lock,      labelRo: "Confidențialitate cont",   labelEn: "Account privacy",      navigateTo: "account-privacy" },
      { icon: Ban,       labelRo: "Blocat",                   labelEn: "Blocked",              navigateTo: "blocked" },
    ],
  },
  {
    titleRo: "Cum pot interacționa alții cu tine",
    titleEn: "How others can interact with you",
    items: [
      { icon: MessageCircle, labelRo: "Mesaje și răspunsuri",     labelEn: "Messages and replies",   navigateTo: "messages-replies" },
      { icon: MessageSquare, labelRo: "Comentarii",               labelEn: "Comments",               navigateTo: "comments" },
      { icon: Share2,        labelRo: "Distribuire și reutilizare", labelEn: "Sharing and reuse",   navigateTo: "sharing-reuse" },
      { icon: UserPlus,      labelRo: "Urmărire și invitare",     labelEn: "Follow and invite",      navigateTo: "follow-invite" },
    ],
  },
  {
    titleRo: "Ce vezi",
    titleEn: "What you see",
    items: [
      { icon: Star,       labelRo: "Favorite",                 labelEn: "Favourites",           navigateTo: "favourites" },
      { icon: Heart,      labelRo: "Aprecieri", labelEn: "Like counts", navigateTo: "like-share-counts" },
    ],
  },
  {
    titleRo: "Aplicația ta",
    titleEn: "Your app",
    items: [
      { icon: Globe,         labelRo: "Limbă și traduceri",      labelEn: "Language",             navigateTo: "language" },
    ],
  },
  {
    titleRo: "Contul tău",
    titleEn: "Your account",
    items: [
      { icon: Lock,   labelRo: "Schimbă parola",  labelEn: "Change password", action: "password" },
      { icon: Trash2, labelRo: "Șterge contul",   labelEn: "Delete account",  action: "delete"   },
    ],
  },
  {
    titleRo: "Informații și suport",
    titleEn: "Info and support",
    items: [
      { icon: HelpCircle, labelRo: "Ajutor",                    labelEn: "Help",                 navigateTo: "help" },
      { icon: Info,       labelRo: "Despre",                    labelEn: "About",                navigateTo: "about" },
    ],
  },
];

export default function SettingsSection({ userId, userRole, onNavigate }: SettingsSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast({ title: lang === "ro" ? "Introdu parola actuală." : "Enter your current password.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: lang === "ro" ? "Parolele nu coincid." : "Passwords don't match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: lang === "ro" ? "Parola trebuie să aibă minim 6 caractere." : "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword === currentPassword) {
      toast({ title: lang === "ro" ? "Parola nouă trebuie să fie diferită de cea actuală." : "New password must be different from the current one.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);

    // Supabase Auth has no direct "verify current password" endpoint, so we
    // confirm it by re-authenticating with it — this also prevents someone
    // with a merely-open session (shared/public device) from locking the
    // real owner out by changing the password without knowing it.
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) {
      toast({ title: lang === "ro" ? "Eroare la verificarea contului." : "Error verifying account.", variant: "destructive" });
      setSavingPassword(false);
      return;
    }
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) {
      toast({ title: lang === "ro" ? "Parola actuală este incorectă." : "Current password is incorrect.", variant: "destructive" });
      setSavingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: lang === "ro" ? "Eroare la schimbarea parolei." : "Error changing password.", description: error.message, variant: "destructive" });
    } else {
      toast({ title: lang === "ro" ? "Parolă schimbată cu succes!" : "Password changed successfully!" });
      setShowChangePassword(false);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    }
    setSavingPassword(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "STERGE") return;
    const { error } = await (supabase as any).rpc("delete_my_account");
    if (error) {
      toast({ title: lang === "ro" ? "Eroare la ștergerea contului." : "Error deleting account.", variant: "destructive" });
    } else {
      await supabase.auth.signOut();
      navigate("/");
    }
  };

  const handleItemClick = (item: SettingsItem) => {
    if (item.navigateTo && onNavigate) {
      onNavigate(item.navigateTo);
      return;
    }
    if (item.action === "soon") {
      toast({ title: lang === "ro" ? "Funcționalitate în curând." : "Coming soon." });
    } else if (item.action === "password") {
      setShowDeleteConfirm(false);
      setShowChangePassword((v) => !v);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } else if (item.action === "delete") {
      setShowChangePassword(false);
      setShowDeleteConfirm((v) => !v);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <h2 className="font-heading text-xl text-foreground px-1 pt-1 pb-4">
        {lang === "ro" ? "Setări și activitate" : "Settings and activity"}
      </h2>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.titleRo}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1 font-body">
              {lang === "ro" ? group.titleRo : group.titleEn}
            </p>
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isPasswordRow = item.action === "password";
                const isDeleteRow = item.action === "delete";

                return (
                  <div key={item.labelRo}>
                    <button
                      onClick={() => handleItemClick(item)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${isDeleteRow ? "text-destructive" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-body flex-1 ${isDeleteRow ? "text-destructive" : "text-foreground"}`}>
                        {lang === "ro" ? item.labelRo : item.labelEn}
                      </span>
                      {item.value && (
                        <span className="text-sm text-muted-foreground font-body mr-1">{item.value}</span>
                      )}
                      <ChevronRight className={`h-4 w-4 text-muted-foreground/50 shrink-0 transition-transform ${
                        (isPasswordRow && showChangePassword) || (isDeleteRow && showDeleteConfirm) ? "rotate-90" : ""
                      }`} />
                    </button>

                    {/* Inline: Change password */}
                    {isPasswordRow && showChangePassword && (
                      <div className="px-5 py-4 space-y-3 bg-muted/20 border-t border-border">
                        <div className="space-y-1">
                          <Label className="text-xs font-body">{lang === "ro" ? "Parola actuală" : "Current password"}</Label>
                          <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="h-9 text-sm font-body" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-body">{lang === "ro" ? "Parolă nouă" : "New password"}</Label>
                          <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-9 text-sm font-body" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-body">{lang === "ro" ? "Confirmă parola nouă" : "Confirm new password"}</Label>
                          <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-9 text-sm font-body" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="font-body text-xs" onClick={() => { setShowChangePassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}>
                            {lang === "ro" ? "Anulează" : "Cancel"}
                          </Button>
                          <Button size="sm" className="font-body text-xs" onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}>
                            {lang === "ro" ? "Salvează" : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Inline: Delete account */}
                    {isDeleteRow && showDeleteConfirm && (
                      <div className="px-5 py-4 space-y-3 bg-destructive/5 border-t border-border">
                        <p className="text-sm text-destructive font-body">
                          {lang === "ro" ? 'Scrie "STERGE" pentru a confirma ștergerea permanentă a contului.' : 'Type "STERGE" to confirm permanent account deletion.'}
                        </p>
                        <Input
                          value={deleteConfirmText}
                          onChange={e => setDeleteConfirmText(e.target.value)}
                          placeholder="STERGE"
                          className="h-9 text-sm font-body border-destructive/50"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="font-body text-xs" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}>
                            {lang === "ro" ? "Anulează" : "Cancel"}
                          </Button>
                          <Button variant="destructive" size="sm" className="font-body text-xs" disabled={deleteConfirmText !== "STERGE"} onClick={handleDeleteAccount}>
                            {lang === "ro" ? "Șterge definitiv" : "Delete permanently"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Logout */}
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors text-destructive font-body text-sm"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {lang === "ro" ? "Deconectare" : "Log out"}
        </button>
      </div>
    </div>
  );
}
