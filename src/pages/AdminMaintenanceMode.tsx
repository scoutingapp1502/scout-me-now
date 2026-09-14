import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Loader2, OctagonX, Zap, CalendarClock } from "lucide-react";

// Converts an ISO timestamp to the local-time value <input type="datetime-local">
// expects (YYYY-MM-DDTHH:mm), and back. The browser input has no timezone
// concept of its own — it's always "whatever the admin's local clock says" —
// so round-tripping through the Date object's local getters/setters keeps
// what the admin typed lined up with what they see, without a UTC shift.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Two entirely separate flows, each with its own button, so there's no
// ambiguity about what "starts" maintenance:
// - Emergency: no dates at all — starts right now, runs open-ended, only
//   ends when the admin presses "Oprește acum".
// - Scheduled: admin picks a real start and end; maintenance turns on and
//   off automatically at those times with no further action needed.
export default function AdminMaintenanceMode({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const maintenance = useMaintenanceMode();
  const [stopping, setStopping] = useState(false);
  const [startingNow, setStartingNow] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  // Seed the schedule form from the live row, but only before the admin has
  // started editing — otherwise a realtime echo of their own save would
  // clobber whatever they're mid-typing.
  useEffect(() => {
    if (maintenance.loading || dirty) return;
    setStartInput(toLocalInputValue(maintenance.scheduledStart));
    setEndInput(toLocalInputValue(maintenance.scheduledEnd));
    setMessage(maintenance.message || "");
  }, [maintenance.loading, maintenance.scheduledStart, maintenance.scheduledEnd, maintenance.message, dirty]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const saveRow = async (fields: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser();
    return (supabase as any)
      .from("maintenance_mode")
      .update({ ...fields, updated_by: user?.id ?? null })
      .eq("id", true);
  };

  // Schedules a real window: both start and end must be set by the admin.
  const handleSchedule = async () => {
    const start = fromLocalInputValue(startInput);
    const end = fromLocalInputValue(endInput);
    if (!start || !end) {
      toast({ title: "Completează atât ora de start, cât și cea de sfârșit.", variant: "destructive" });
      return;
    }
    if (new Date(end) <= new Date(start)) {
      toast({ title: "Ora de sfârșit trebuie să fie după ora de start.", variant: "destructive" });
      return;
    }
    setScheduling(true);
    const { error } = await saveRow({
      is_scheduled: true,
      scheduled_start: start,
      scheduled_end: end,
      end_is_estimate: false,
      message: message.trim() || null,
    });
    setScheduling(false);
    if (error) {
      toast({ title: "Eroare la salvare.", variant: "destructive" });
      return;
    }
    setDirty(false);
    toast({ title: "Mentenanța a fost programată." });
  };

  const handleCancelSchedule = async () => {
    setScheduling(true);
    const { error } = await saveRow({ is_scheduled: false });
    setScheduling(false);
    if (error) {
      toast({ title: "Eroare la anulare.", variant: "destructive" });
      return;
    }
    setDirty(false);
    toast({ title: "Programarea a fost anulată." });
  };

  // Emergency stop: ends maintenance immediately by turning off
  // is_scheduled — isActive is derived from is_scheduled + the time window,
  // so there's no separate "active" flag that could be left on by mistake.
  const handleStopNow = async () => {
    setStopping(true);
    const { error } = await saveRow({ is_scheduled: false });
    setStopping(false);
    if (error) {
      toast({ title: "Eroare la oprire.", variant: "destructive" });
      return;
    }
    setDirty(false);
    toast({ title: "Mentenanța a fost oprită." });
  };

  // Emergency start: no dates at all — starts right now and has no upper
  // bound (isActive treats a null scheduled_end as open-ended), per explicit
  // instruction that an emergency start's duration is unknown until the
  // admin stops it manually.
  const handleStartNow = async () => {
    setStartingNow(true);
    const { error } = await saveRow({
      is_scheduled: true,
      scheduled_start: new Date().toISOString(),
      scheduled_end: null,
      end_is_estimate: false,
    });
    setStartingNow(false);
    if (error) {
      toast({ title: "Eroare la pornire.", variant: "destructive" });
      return;
    }
    toast({ title: "Mentenanța a fost pornită." });
  };

  return (
    <div className={embedded ? "text-gray-900" : "min-h-screen bg-gray-200 text-gray-900"}>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {embedded && (
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Mentenanță
          </h1>
        )}

        {maintenance.isActive && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700 font-semibold">
              Mentenanța este ACTIVĂ chiar acum — toți utilizatorii (în afară de admini) văd pagina de mentenanță.
            </p>
          </div>
        )}

        {/* Emergency start/stop — no dates, no schedule */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="font-semibold text-gray-900">Pornire de urgență</p>
          </div>
          <p className="text-xs text-gray-500">
            Pornește mentenanța chiar acum, fără dată de sfârșit — rămâne activă până o oprești manual de aici.
          </p>
          {maintenance.isActive ? (
            <Button type="button" size="sm" variant="destructive" disabled={stopping} onClick={handleStopNow} className="gap-1.5">
              {stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <OctagonX className="h-3.5 w-3.5" />}
              Oprește acum
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={startingNow} onClick={handleStartNow} className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white">
              {startingNow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Pornește acum
            </Button>
          )}
        </div>

        {/* Scheduled window — real start + end, automatic on/off */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-gray-500 shrink-0" />
            <div>
              <p className="font-semibold text-gray-900">Mentenanță programată</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Pornește și se oprește automat la orele de mai jos. Utilizatorii văd un banner discret înainte de start.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Start</label>
              <Input type="datetime-local" value={startInput} onChange={(e) => markDirty(setStartInput)(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sfârșit</label>
              <Input type="datetime-local" value={endInput} onChange={(e) => markDirty(setEndInput)(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mesaj (opțional)</label>
            <Textarea
              placeholder="Ex: Facem îmbunătățiri la platformă. Revenim curând!"
              value={message}
              onChange={(e) => markDirty(setMessage)(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleSchedule} disabled={scheduling || maintenance.loading} className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5">
              {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Programează mentenanța
            </Button>
            {maintenance.isScheduled && (
              <Button type="button" size="sm" variant="outline" disabled={scheduling} onClick={handleCancelSchedule}>
                Anulează programarea
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
