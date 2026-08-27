import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Share2, Lock, CheckCircle2, Clock } from "lucide-react";
import { useInviteFriends } from "@/hooks/useInviteFriends";
import { useLanguage } from "@/i18n/LanguageContext";

interface TestDef {
  key: string;
  label: string;
  icon: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  unlockedTests: string[];
  availableTests: TestDef[];
  onUnlocked: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-green-600",
  "bg-blue-600",
  "bg-orange-500",
  "bg-purple-600",
  "bg-pink-600",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function InviteFriendsModal({
  open,
  onOpenChange,
  userId,
  unlockedTests,
  availableTests,
  onUnlocked,
}: Props) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const ti = t.dashboard.inviteFriends;
  const invite = useInviteFriends(userId, open);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const lockedTests = availableTests.filter((t) => !unlockedTests.includes(t.key));
  const canUnlock = invite.availableUnlockSlots > 0;
  const neededMore = 3 - invite.validatedCount;

  const whatsappText = (code: string) => ti.whatsappMessageTemplate.replace("{code}", code);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
      toast({ title: ti.codeCopiedTitle, description: invite.code });
    } catch {
      toast({ title: ti.yourCodeTitle, description: invite.code });
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(whatsappText(invite.code));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: ti.shareTitle, text: whatsappText(invite.code) });
      } catch { /* cancelled */ }
    } else {
      handleCopy();
    }
  };

  const handleUnlock = async (testKey: string) => {
    setUnlocking(testKey);
    const ok = await invite.unlockTestViaInvite(testKey);
    setUnlocking(null);
    if (ok) {
      toast({ title: ti.testUnlockedTitle, description: ti.testUnlockedDesc });
      onUnlocked();
    }
  };

  const emptySlots = Math.max(0, 3 - invite.invitees.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] p-0 bg-white border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-200">
          <h2 className="font-display text-xl text-gray-900">{ti.title}</h2>
          <p className="text-xs text-orange-600 font-body mt-0.5">{ti.subtitle}</p>
        </div>

        <div className="px-5 pb-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {invite.loading ? (
            <div className="py-8 text-center text-gray-500 text-sm font-body">{ti.loading}</div>
          ) : (
            <>
              {/* Invite code */}
              <div className="mt-4">
                <p className="text-[10px] font-body text-gray-500 uppercase tracking-widest mb-2">
                  {ti.yourInviteCode}
                </p>
                <div className="flex gap-2 mb-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 flex items-center">
                    <span className="font-mono text-xl text-orange-600 tracking-[0.2em] font-bold">
                      {invite.code}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto px-4 border-gray-200 text-gray-900 gap-1.5 font-body text-sm"
                    onClick={handleCopy}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {ti.copyBtn}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-9 gap-2 font-body text-sm border-gray-200 text-gray-900"
                    onClick={handleWhatsApp}
                  >
                    <span className="text-base">💬</span>
                    {ti.whatsappBtn}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 gap-2 font-body text-sm border-gray-200 text-gray-900"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4" />
                    {ti.shareBtn}
                  </Button>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-body text-gray-500 uppercase tracking-widest">
                    {ti.inviteProgress}
                  </span>
                  <span className="text-xs font-body text-gray-900 font-semibold">
                    {invite.validatedCount} / 3
                  </span>
                </div>
                {/* Thin progress bar */}
                <div className="h-1 bg-gray-200 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-lime-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((invite.validatedCount / 3) * 100, 100)}%` }}
                  />
                </div>

                {/* Invitee list */}
                <div className="space-y-2">
                  {invite.invitees.map((inv) => (
                    <div
                      key={inv.userId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200"
                    >
                      <div
                        className={`w-8 h-8 rounded-full ${avatarColor(inv.name)} flex items-center justify-center shrink-0`}
                      >
                        <span className="font-display text-xs text-white font-bold">
                          {getInitials(inv.name)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body text-gray-900 font-semibold leading-tight truncate">
                          {inv.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                inv.validated ? "bg-lime-400" : "bg-orange-500"
                              }`}
                              style={{ width: `${Math.round(inv.completion)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-body text-gray-500 shrink-0">
                            {Math.round(inv.completion)}%
                          </span>
                        </div>
                      </div>
                      {inv.validated ? (
                        <div className="flex items-center gap-1 shrink-0 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span className="text-[11px] font-body text-green-600 font-semibold">{ti.validatedLabel}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-0.5">
                          <Clock className="h-3 w-3 text-orange-500" />
                          <span className="text-[11px] font-body text-orange-600">{ti.inProgressLabel}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {Array.from({ length: emptySlots }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-dashed border-gray-300"
                    >
                      <div className="w-8 h-8 rounded-full border border-dashed border-gray-300 flex items-center justify-center shrink-0">
                        <span className="text-gray-400 text-sm">?</span>
                      </div>
                      <p className="text-sm font-body text-gray-400 flex-1">{ti.emptySlot}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test unlock section */}
              <div>
                <div className={`flex items-center gap-2 mb-1 ${!canUnlock ? "opacity-50" : ""}`}>
                  <Lock className="h-4 w-4 text-gray-500 shrink-0" />
                  <span className="text-sm font-body font-semibold text-gray-900">
                    {ti.chooseTestToUnlock}
                  </span>
                </div>
                {!canUnlock && neededMore > 0 && (
                  <p className="text-xs text-gray-500 font-body mb-3 ml-6">
                    {ti.needMorePrefix}{" "}
                    <strong className="text-gray-900">{neededMore} {neededMore === 1 ? ti.validatedFriendSingular : ti.validatedFriendPlural}</strong>
                  </p>
                )}
                {lockedTests.length === 0 ? (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                    <span className="text-xs font-body text-gray-900">{ti.allTestsUnlocked}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {lockedTests.map((test) => {
                      const alreadyUsed = invite.inviteUnlockedTests.includes(test.key);
                      const isUnlockable = canUnlock && !alreadyUsed;
                      return (
                        <button
                          key={test.key}
                          disabled={!isUnlockable || unlocking === test.key}
                          onClick={() => isUnlockable && handleUnlock(test.key)}
                          className={`p-3 rounded-lg border text-center transition-all w-full ${
                            alreadyUsed
                              ? "bg-green-50 border-green-200"
                              : isUnlockable
                              ? "bg-orange-50 border-orange-300 hover:border-orange-500 cursor-pointer"
                              : "bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          {isUnlockable ? (
                            <>
                              <div className="text-xl mb-1">{test.icon}</div>
                              <p className="text-xs font-body text-gray-900 leading-tight">{test.label}</p>
                            </>
                          ) : (
                            <p className="text-xs font-body text-gray-500 py-2">
                              {alreadyUsed ? `✓ ${test.label}` : ti.testLockedLabel}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-[10px] font-body text-gray-500 uppercase tracking-widest mb-3">
                  {ti.howItWorks}
                </p>
                <ol className="space-y-3">
                  {[
                    ti.step1,
                    ti.step2,
                    ti.step3,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-display flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-gray-700 font-body leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
