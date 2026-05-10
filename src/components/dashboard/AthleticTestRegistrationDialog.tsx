import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  defaultFirstName?: string;
  defaultLastName?: string;
  defaultEmail?: string;
}

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

const AthleticTestRegistrationDialog = ({
  open,
  onOpenChange,
  userId,
  defaultFirstName = "",
  defaultLastName = "",
  defaultEmail = "",
}: Props) => {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [pendingDate, setPendingDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [time, setTime] = useState<string>("");
  const [notificationMethod, setNotificationMethod] = useState<"email" | "phone">("email");
  const [submitting, setSubmitting] = useState(false);

  const handleApplyDate = () => {
    setDate(pendingDate);
    setDatePickerOpen(false);
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !date || !time) {
      toast({ title: "Câmpuri lipsă", description: "Te rog completează toate câmpurile.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const [hours, minutes] = time.split(":").map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const { error } = await supabase.from("athletic_test_registrations").insert({
      user_id: userId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      scheduled_at: scheduledAt.toISOString(),
      notification_method: notificationMethod,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Înscriere confirmată!",
      description: `Dovada înscrierii va fi trimisă prin ${notificationMethod === "email" ? "email" : "telefon"}.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide">Înscriere Teste Atletice</DialogTitle>
          <DialogDescription className="font-body">
            Completează datele pentru a te programa la testările atletice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="atr-fn">Nume</Label>
              <Input id="atr-fn" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="atr-ln">Prenume</Label>
              <Input id="atr-ln" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atr-email">Email</Label>
            <Input id="atr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atr-phone">Număr de telefon</Label>
            <Input id="atr-phone" type="tel" placeholder="+40..." value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Alege ziua programării</Label>
            <Popover
              open={datePickerOpen}
              onOpenChange={(open) => {
                setDatePickerOpen(open);
                if (open) setPendingDate(date);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ro }) : "Selectează data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                <div className="p-2 space-y-2">
                  <Calendar
                    mode="single"
                    selected={pendingDate}
                    onSelect={setPendingDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    captionLayout="dropdown-buttons"
                    fromYear={new Date().getFullYear()}
                    toYear={new Date().getFullYear() + 1}
                    initialFocus
                    className="pointer-events-auto"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleApplyDate} disabled={!pendingDate}>
                      Aplică
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Alege ora</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează ora" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dovada înscrierii trimisă pe:</Label>
            <RadioGroup value={notificationMethod} onValueChange={(v) => setNotificationMethod(v as "email" | "phone")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="notif-email" />
                <Label htmlFor="notif-email" className="font-normal cursor-pointer">Email</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="phone" id="notif-phone" />
                <Label htmlFor="notif-phone" className="font-normal cursor-pointer">Telefon (SMS)</Label>
              </div>
            </RadioGroup>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-display uppercase tracking-wider"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmă înscrierea
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AthleticTestRegistrationDialog;
