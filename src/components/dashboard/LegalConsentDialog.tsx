import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface LegalConsentDialogProps {
  open: boolean;
  onAccept: () => Promise<{ error: unknown }>;
}

// Blocking on purpose: no close button, Escape and outside clicks are
// ignored. The only ways out are accepting or signing out.
const LegalConsentDialog = ({ open, onAccept }: LegalConsentDialogProps) => {
  const { t } = useLanguage();
  const tt = t.legalConsent;
  const { toast } = useToast();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    setSaving(true);
    const { error } = await onAccept();
    setSaving(false);
    if (error) toast({ title: tt.error, variant: "destructive" });
  };

  return (
    <Dialog open={open}>
      <DialogContent
        hideClose
        className="bg-white border-gray-200 text-gray-900 max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-orange-500 shrink-0" />
            <DialogTitle className="font-heading text-left">{tt.title}</DialogTitle>
          </div>
          <DialogDescription className="text-gray-500 font-body text-sm text-left pt-2">
            {tt.body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-body">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline underline-offset-2">{tt.termsLink}</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline underline-offset-2">{tt.privacyLink}</a>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer mt-1">
          <Checkbox checked={checked} onCheckedChange={(c) => setChecked(c === true)} className="mt-0.5" />
          <span className="text-sm text-gray-700 font-body leading-snug">{tt.checkboxLabel}</span>
        </label>

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => supabase.auth.signOut()}>
            {tt.logout}
          </Button>
          <Button
            type="button"
            disabled={!checked || saving}
            onClick={handleAccept}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {tt.accept}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LegalConsentDialog;
