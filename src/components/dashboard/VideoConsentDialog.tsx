import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface VideoConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}

const VideoConsentDialog = ({ open, onOpenChange, onConfirm, loading }: VideoConsentDialogProps) => {
  const { t } = useLanguage();
  const tt = t.videoConsent;
  const [checked, setChecked] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setChecked(false); onOpenChange(o); }}>
      <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500 shrink-0" />
            <DialogTitle className="font-heading text-left">{tt.title}</DialogTitle>
          </div>
          <DialogDescription className="text-gray-500 font-body whitespace-pre-line text-sm text-left pt-2">
            {tt.body}
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-start gap-2.5 cursor-pointer mt-1">
          <Checkbox checked={checked} onCheckedChange={(c) => setChecked(c === true)} className="mt-0.5" />
          <span className="text-sm text-gray-700 font-body leading-snug">{tt.checkboxLabel}</span>
        </label>

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tt.cancel}
          </Button>
          <Button
            type="button"
            disabled={!checked || loading}
            onClick={onConfirm}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {tt.accept}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VideoConsentDialog;
