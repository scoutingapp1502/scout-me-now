import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MaintenanceState {
  isScheduled: boolean;
  isActive: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  // False for an emergency "start now" with no real end time chosen — the
  // stored scheduled_end in that case is just a synthetic +1h placeholder,
  // not something the admin actually picked, so the UI shouldn't present it
  // as an estimate.
  endIsEstimate: boolean;
  message: string | null;
}

const EMPTY_STATE: Omit<MaintenanceState, "isActive"> = {
  isScheduled: false,
  scheduledStart: null,
  scheduledEnd: null,
  endIsEstimate: false,
  message: null,
};

function mapRow(row: any): Omit<MaintenanceState, "isActive"> {
  return {
    isScheduled: !!row?.is_scheduled,
    scheduledStart: row?.scheduled_start ?? null,
    scheduledEnd: row?.scheduled_end ?? null,
    endIsEstimate: !!row?.end_is_estimate,
    message: row?.message ?? null,
  };
}

// Single global row. Correctness never depends on realtime (which can be
// unreliable — a subscription can silently fail to connect and this table
// then looks permanently frozen at whatever it fetched on mount, letting a
// user who's already on the page keep editing right through an
// admin-started maintenance window). Instead this actively re-fetches the
// row from the database on a short interval — a real network round trip,
// not just a local timer recomputing against stale data — so an
// already-open tab is guaranteed to notice maintenance starting/ending
// within one poll cycle, with or without realtime working. Realtime is
// still wired up on top since it's strictly faster when it does work.
const POLL_INTERVAL_MS = 5000;

// isActive is deliberately NOT read from the database as a stored boolean —
// it's derived client-side from "is now inside [scheduled_start,
// scheduled_end)". That means maintenance starts and ends automatically at
// the times the admin picked, with no second manual toggle to flip at the
// right moment. To end maintenance early, the admin turns is_scheduled off
// (or edits scheduled_end back to "now") from the admin panel — there's no
// separate "force active" switch to get out of sync with the schedule.
export function useMaintenanceMode() {
  const [row, setRow] = useState<Omit<MaintenanceState, "isActive">>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const fetchRow = () => {
      (supabase as any)
        .from("maintenance_mode")
        .select("*")
        .eq("id", true)
        .maybeSingle()
        .then(({ data, error }: any) => {
          if (cancelled) return;
          if (error) { console.error("Failed to load maintenance mode:", error); return; }
          setRow(mapRow(data));
          setNowTick(Date.now());
          setLoading(false);
        });
    };

    fetchRow();
    const pollInterval = setInterval(fetchRow, POLL_INTERVAL_MS);

    // A unique channel name per mount avoids any chance of collision with
    // another instance of this hook subscribing/unsubscribing around the
    // same time (e.g. the admin panel and Dashboard.tsx both using it,
    // possibly in the same tab during navigation) — Supabase multiplexes
    // multiple channels over one socket fine, so there's no cost to this.
    const channel = supabase
      .channel(`maintenance-mode-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_mode" },
        (payload) => {
          setRow(mapRow(payload.new ?? payload.old));
        }
      )
      .subscribe((status, err) => {
        // CLOSED fires on every normal cleanup (unmount, tab backgrounding,
        // a brief network blip before reconnect) — it's not a failure, just
        // the expected terminal status, and correctness never depends on it
        // (see the polling comment above). Only CHANNEL_ERROR/TIMED_OUT
        // indicate the subscribe itself actually failed.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("maintenance_mode realtime subscription issue:", status, err);
        }
      });

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const start = row.scheduledStart ? new Date(row.scheduledStart).getTime() : null;
  const end = row.scheduledEnd ? new Date(row.scheduledEnd).getTime() : null;
  // No end time at all (the "start now, I'll stop it manually" emergency
  // case) means the window is open-ended — active from start onward until
  // an admin turns is_scheduled off, never auto-expiring on its own.
  const isActive = row.isScheduled && start !== null && nowTick >= start && (end === null || nowTick < end);
  const windowPassed = row.isScheduled && end !== null && nowTick >= end;

  return {
    ...row,
    isActive,
    // Exposed so the banner can hide itself once the window has fully
    // passed, even though is_scheduled is still true in the database until
    // the admin clears it.
    windowPassed,
    loading,
  };
}
