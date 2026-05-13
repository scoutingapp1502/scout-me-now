import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Share2, Lock, CheckCircle2, Clock } from "lucide-react";
import { useInviteFriends } from "@/hooks/useInviteFriends";

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

const WHATSAPP_TEXT = (code: string) =>
  `Bună! Te invit pe SportRise, platforma pentru sportivii care vor să fie văzuți de scouters! Folosește codul meu de invitație la înregistrare: *${code}* 🏆`;

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-green-700",
  "bg-blue-700",
  "bg-orange-700",
  "bg-purple-700",
  "bg-pink-700",
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
  const invite = useInviteFriends(userId, open);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const lockedTests = availableTests.filter((t) => !unlockedTests.includes(t.key));
  const canUnlock = invite.availableUnlockSlots > 0;
  const neededMore = 3 - invite.validatedCount;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
      toast({ title: "Cod copiat!", description: invite.code });
    } catch {
      toast({ title: "Codul tău:", description: invite.code });
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(WHATSAPP_TEXT(invite.code));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "SportRise – Invitație", text: WHATSAPP_TEXT(invite.code) });
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
      toast({ title: "🎁 Test deblocat!", description: "Ai deblocat un test tehnic prin invitații tale." });
      onUnlocked();
    }
  };

  const emptySlots = Math.max(0, 3 - invite.invitees.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] p-0 bg-[#0f1f0f] border border-[#1a3a1a] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-[#1a3a1a]">
          <h2 className="font-display text-xl text-foreground">Invită prieteni</h2>
          <p className="text-xs text-primary font-body mt-0.5">3 prieteni validați = 1 test la alegere</p>
        </div>

        <div className="px-5 pb-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {invite.loading ? (
            <div className="py-8 text-center text-muted-foreground text-sm font-body">Se încarcă...</div>
          ) : (
            <>
              {/* Invite code */}
              <div className="mt-4">
                <p className="text-[10px] font-body text-muted-foreground uppercase tracking-widest mb-2">
                  Codul tău de invitație
                </p>
                <div className="flex gap-2 mb-2">
                  <div className="flex-1 bg-[#162016] border border-[#2a4a2a] rounded-lg px-4 py-2.5 flex items-center">
                    <span className="font-mono text-xl text-primary tracking-[0.2em] font-bold">
                      {invite.code}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto px-4 border-border text-foreground gap-1.5 font-body text-sm"
                    onClick={handleCopy}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiază
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-9 gap-2 font-body text-sm border-border text-foreground"
                    onClick={handleWhatsApp}
                  >
                    <span className="text-base">💬</span>
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 gap-2 font-body text-sm border-border text-foreground"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4" />
                    Distribuie
                  </Button>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-body text-muted-foreground uppercase tracking-widest">
                    Progres invitați
                  </span>
                  <span className="text-xs font-body text-primary font-semibold">
                    {invite.validatedCount} / 3
                  </span>
                </div>
                {/* Thin progress bar */}
                <div className="h-1 bg-[#1a3a1a] rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((invite.validatedCount / 3) * 100, 100)}%` }}
                  />
                </div>

                {/* Invitee list */}
                <div className="space-y-2">
                  {invite.invitees.map((inv) => (
                    <div
                      key={inv.userId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#162016] border border-[#2a4a2a]"
                    >
                      <div
                        className={`w-8 h-8 rounded-full ${avatarColor(inv.name)} flex items-center justify-center shrink-0`}
                      >
                        <span className="font-display text-xs text-white font-bold">
                          {getInitials(inv.name)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body text-foreground font-semibold leading-tight truncate">
                          {inv.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-[#0a180a] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                inv.validated ? "bg-primary" : "bg-orange-500"
                              }`}
                              style={{ width: `${Math.round(inv.completion)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-body text-muted-foreground shrink-0">
                            {Math.round(inv.completion)}%
                          </span>
                        </div>
                      </div>
                      {inv.validated ? (
                        <div className="flex items-center gap-1 shrink-0 bg-primary/10 border border-primary/30 rounded-full px-2.5 py-0.5">
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                          <span className="text-[11px] font-body text-primary font-semibold">Validat</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0 bg-orange-500/10 border border-orange-500/30 rounded-full px-2.5 py-0.5">
                          <Clock className="h-3 w-3 text-orange-400" />
                          <span className="text-[11px] font-body text-orange-400">În progres</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {Array.from({ length: emptySlots }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#0f1a0f] border border-dashed border-[#2a4a2a]/50"
                    >
                      <div className="w-8 h-8 rounded-full border border-dashed border-[#2a4a2a] flex items-center justify-center shrink-0">
                        <span className="text-[#2a4a2a] text-sm">?</span>
                      </div>
                      <p className="text-sm font-body text-muted-foreground/40 flex-1">Slot liber...</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-body border-border text-foreground"
                        onClick={handleCopy}
                      >
                        Trimite cod
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test unlock section */}
              <div>
                <div className={`flex items-center gap-2 mb-1 ${!canUnlock ? "opacity-50" : ""}`}>
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-body font-semibold text-foreground">
                    Alege testul pe care vrei să-l deblochezi
                  </span>
                </div>
                {!canUnlock && neededMore > 0 && (
                  <p className="text-xs text-muted-foreground font-body mb-3 ml-6">
                    Mai ai nevoie de{" "}
                    <strong className="text-foreground">{neededMore} prieten{neededMore === 1 ? "" : "i"} validat{neededMore === 1 ? "" : "i"}</strong>
                  </p>
                )}
                {lockedTests.length === 0 ? (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
                    <span className="text-xs font-body text-foreground">🏆 Toate testele sunt deja deblocate!</span>
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
                              ? "bg-primary/10 border-primary/30"
                              : isUnlockable
                              ? "bg-[#162016] border-primary/40 hover:border-primary cursor-pointer"
                              : "bg-[#0f1a0f] border-[#1a3a1a] opacity-50 cursor-not-allowed"
                          }`}
                        >
                          {isUnlockable ? (
                            <>
                              <div className="text-xl mb-1">{test.icon}</div>
                              <p className="text-xs font-body text-foreground leading-tight">{test.label}</p>
                            </>
                          ) : (
                            <p className="text-xs font-body text-muted-foreground py-2">
                              {alreadyUsed ? `✓ ${test.label}` : "??? Test blocat"}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="border-t border-[#1a3a1a] pt-4">
                <p className="text-[10px] font-body text-muted-foreground uppercase tracking-widest mb-3">
                  Cum funcționează
                </p>
                <ol className="space-y-3">
                  {[
                    "Copiezi codul și îl trimiți prietenilor pe WhatsApp sau Instagram.",
                    "Prietenii se înregistrează cu codul tău și completează profilul la 55%.",
                    "Când 3 sunt validați, tu alegi ce test tehnic se deblochează.",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-display flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-primary font-body leading-relaxed">{step}</p>
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
