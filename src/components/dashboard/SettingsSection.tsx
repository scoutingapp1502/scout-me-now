import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKeys } from "@/i18n/translations";
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
  labelKey: keyof TranslationKeys["dashboard"]["settings"];
  id: string;
  value?: string;
  action?: "soon" | "password" | "delete" | "logout";
  navigateTo?: string;
};

type SettingsGroup = {
  titleKey: keyof TranslationKeys["dashboard"]["settings"];
  id: string;
  items: SettingsItem[];
};

const groups: SettingsGroup[] = [
  {
    titleKey: "groupUsage",
    id: "usage",
    items: [
      { icon: Bookmark,  labelKey: "itemSaved",           id: "saved",           navigateTo: "saved" },
      { icon: Archive,   labelKey: "itemArchive",         id: "archive",         navigateTo: "archive" },
      { icon: Activity,  labelKey: "itemYourActivity",    id: "your-activity",   navigateTo: "your-activity" },
      { icon: Bell,      labelKey: "itemNotifications",   id: "notifications",   navigateTo: "notification-settings" },
      { icon: Timer,     labelKey: "itemTimeManagement",  id: "time-management", navigateTo: "time-management" },
    ],
  },
  {
    titleKey: "groupPrivacy",
    id: "privacy",
    items: [
      { icon: Lock, labelKey: "itemAccountPrivacy", id: "account-privacy", navigateTo: "account-privacy" },
      { icon: Ban,  labelKey: "itemBlocked",         id: "blocked",         navigateTo: "blocked" },
    ],
  },
  {
    titleKey: "groupInteraction",
    id: "interaction",
    items: [
      { icon: MessageCircle, labelKey: "itemMessagesReplies", id: "messages-replies", navigateTo: "messages-replies" },
      { icon: MessageSquare, labelKey: "itemComments",        id: "comments",         navigateTo: "comments" },
      { icon: Share2,        labelKey: "itemSharingReuse",    id: "sharing-reuse",    navigateTo: "sharing-reuse" },
      { icon: UserPlus,      labelKey: "itemFollowInvite",    id: "follow-invite",    navigateTo: "follow-invite" },
    ],
  },
  {
    titleKey: "groupWhatYouSee",
    id: "what-you-see",
    items: [
      { icon: Star,  labelKey: "itemFavourites", id: "favourites",         navigateTo: "favourites" },
      { icon: Heart, labelKey: "itemLikeCounts", id: "like-share-counts",  navigateTo: "like-share-counts" },
    ],
  },
  {
    titleKey: "groupApp",
    id: "app",
    items: [
      { icon: Globe, labelKey: "itemLanguage", id: "language", navigateTo: "language" },
    ],
  },
  {
    titleKey: "groupAccount",
    id: "account",
    items: [
      { icon: Lock,   labelKey: "itemChangePassword", id: "change-password", action: "password" },
      { icon: Trash2, labelKey: "itemDeleteAccount",  id: "delete-account",  action: "delete"   },
    ],
  },
  {
    titleKey: "groupSupport",
    id: "support",
    items: [
      { icon: HelpCircle, labelKey: "itemHelp",  id: "help",  navigateTo: "help" },
      { icon: Info,       labelKey: "itemAbout", id: "about", navigateTo: "about" },
    ],
  },
];

export default function SettingsSection({ userId, userRole, onNavigate }: SettingsSectionProps) {
  const { t } = useLanguage();
  const ts = t.dashboard.settings;
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
      toast({ title: ts.toastEnterCurrentPassword, variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: ts.toastPasswordsMismatch, variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: ts.toastPasswordTooShort, variant: "destructive" });
      return;
    }
    if (newPassword === currentPassword) {
      toast({ title: ts.toastPasswordSameAsOld, variant: "destructive" });
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
      toast({ title: ts.toastAccountVerifyError, variant: "destructive" });
      setSavingPassword(false);
      return;
    }
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) {
      toast({ title: ts.toastCurrentPasswordWrong, variant: "destructive" });
      setSavingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: ts.toastChangePasswordError, description: error.message, variant: "destructive" });
    } else {
      toast({ title: ts.toastChangePasswordSuccess });
      setShowChangePassword(false);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    }
    setSavingPassword(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "STERGE") return;
    const { error } = await (supabase as any).rpc("delete_my_account");
    if (error) {
      toast({ title: ts.toastDeleteAccountError, variant: "destructive" });
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
      toast({ title: ts.toastComingSoon });
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
      <h2 className="font-heading text-xl text-gray-900 px-1 pt-1 pb-4">
        {ts.pageTitle}
      </h2>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.id}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-1 font-body">
              {ts[group.titleKey]}
            </p>
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-200">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isPasswordRow = item.action === "password";
                const isDeleteRow = item.action === "delete";

                return (
                  <div key={item.id}>
                    <button
                      onClick={() => handleItemClick(item)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${isDeleteRow ? "text-destructive" : "text-gray-500"}`} />
                      <span className={`text-sm font-body flex-1 ${isDeleteRow ? "text-destructive" : "text-gray-900"}`}>
                        {ts[item.labelKey]}
                      </span>
                      {item.value && (
                        <span className="text-sm text-gray-500 font-body mr-1">{item.value}</span>
                      )}
                      <ChevronRight className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${
                        (isPasswordRow && showChangePassword) || (isDeleteRow && showDeleteConfirm) ? "rotate-90" : ""
                      }`} />
                    </button>

                    {/* Inline: Change password */}
                    {isPasswordRow && showChangePassword && (
                      <div className="px-5 py-4 space-y-3 bg-gray-50">
                        <div className="space-y-1">
                          <Label className="text-xs font-body">{ts.currentPasswordLabel}</Label>
                          <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="h-9 text-sm font-body" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-body">{ts.newPasswordLabel}</Label>
                          <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-9 text-sm font-body" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-body">{ts.confirmNewPasswordLabel}</Label>
                          <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-9 text-sm font-body" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="font-body text-xs" onClick={() => { setShowChangePassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}>
                            {ts.cancelBtn}
                          </Button>
                          <Button size="sm" className="font-body text-xs bg-orange-500 hover:bg-orange-600 text-white" onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}>
                            {t.dashboard.profile.save}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Inline: Delete account */}
                    {isDeleteRow && showDeleteConfirm && (
                      <div className="px-5 py-4 space-y-3 bg-destructive/5 border-t border-gray-200">
                        <p className="text-sm text-destructive font-body">
                          {ts.deleteConfirmPrompt}
                        </p>
                        <Input
                          value={deleteConfirmText}
                          onChange={e => setDeleteConfirmText(e.target.value)}
                          placeholder="STERGE"
                          className="h-9 text-sm font-body border-destructive/50"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="font-body text-xs" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}>
                            {ts.cancelBtn}
                          </Button>
                          <Button variant="destructive" size="sm" className="font-body text-xs" disabled={deleteConfirmText !== "STERGE"} onClick={handleDeleteAccount}>
                            {ts.deletePermanentlyBtn}
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
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-destructive font-body text-sm"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {ts.logoutBtn}
        </button>
      </div>
    </div>
  );
}
