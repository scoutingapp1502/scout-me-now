import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Search, ArrowLeft, ArrowRight, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

interface PlayerStatsProps {
  userId: string;
  isOwner: boolean;
}

const LOCALE_BY_LANG: Record<Language, string> = {
  ro: "ro-RO", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT",
};

function formatRange(start: Date, end: Date, lang: Language): string {
  const locale = LOCALE_BY_LANG[lang] || "en-US";
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = `${start.getDate()} ${monthFmt.format(start)}`;
  const endLabel = sameMonth ? `${end.getDate()}` : `${end.getDate()} ${monthFmt.format(end)}`;
  return `${startLabel} – ${endLabel}`;
}

function trendPct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function TrendCard({ value, label, trend, rangeLabel }: { value: number | string; label: string; trend: number; rangeLabel: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 font-body">{label}</p>
      <div className="flex items-center gap-1.5 mt-2">
        <span className={`h-1.5 w-1.5 rounded-full ${trend > 0 ? "bg-green-500" : trend < 0 ? "bg-red-500" : "bg-gray-400"}`} />
        <span className="text-xs text-gray-500 font-body">
          {trend > 0 ? "+" : ""}{trend}% {rangeLabel}
        </span>
      </div>
    </div>
  );
}

const PlayerStats = ({ userId, isOwner }: PlayerStatsProps) => {
  const { lang, t } = useLanguage();
  const [profileViews, setProfileViews] = useState(0);
  const [searchAppearances, setSearchAppearances] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showOverview, setShowOverview] = useState(false);

  const [overview, setOverview] = useState({
    postImpressions: 0,
    postImpressionsTrend: 0,
    totalFollowers: 0,
    visitors90d: 0,
    searchAppearances7d: 0,
    searchTrend: 0,
    currentRange: "",
    previousRange: "",
  });
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) return;
    fetchStats();
  }, [userId, isOwner]);

  const fetchStats = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString();

    const [viewsRes, searchRes] = await Promise.all([
      supabase
        .from("profile_analytics")
        .select("id", { count: "exact", head: true })
        .eq("profile_user_id", userId)
        .eq("event_type", "profile_view")
        .gte("created_at", since),
      supabase
        .from("profile_analytics")
        .select("id", { count: "exact", head: true })
        .eq("profile_user_id", userId)
        .eq("event_type", "search_appearance")
        .gte("created_at", since),
    ]);

    setProfileViews(viewsRes.count || 0);
    setSearchAppearances(searchRes.count || 0);
    setLoading(false);
  };

  const fetchOverview = async () => {
    setOverviewLoading(true);

    const now = new Date();
    const currentStart = new Date(now); currentStart.setDate(now.getDate() - 6);
    const previousEnd = new Date(currentStart); previousEnd.setDate(currentStart.getDate() - 1);
    const previousStart = new Date(previousEnd); previousStart.setDate(previousEnd.getDate() - 6);
    const ninetyDaysAgo = new Date(now); ninetyDaysAgo.setDate(now.getDate() - 90);

    const currentStartIso = currentStart.toISOString();
    const previousStartIso = previousStart.toISOString();
    const previousEndIso = previousEnd.toISOString();

    const [
      impressionsCurrentRes,
      impressionsPreviousRes,
      followersRes,
      visitorsRes,
      searchCurrentRes,
      searchPreviousRes,
    ] = await Promise.all([
      supabase.from("profile_analytics").select("id", { count: "exact", head: true })
        .eq("profile_user_id", userId).eq("event_type", "post_impression").gte("created_at", currentStartIso),
      supabase.from("profile_analytics").select("id", { count: "exact", head: true })
        .eq("profile_user_id", userId).eq("event_type", "post_impression").gte("created_at", previousStartIso).lte("created_at", previousEndIso),
      supabase.from("follows").select("id", { count: "exact", head: true })
        .eq("following_id", userId).eq("status", "accepted"),
      supabase.from("profile_analytics").select("viewer_user_id")
        .eq("profile_user_id", userId).eq("event_type", "profile_view").gte("created_at", ninetyDaysAgo.toISOString()),
      supabase.from("profile_analytics").select("id", { count: "exact", head: true })
        .eq("profile_user_id", userId).eq("event_type", "search_appearance").gte("created_at", currentStartIso),
      supabase.from("profile_analytics").select("id", { count: "exact", head: true })
        .eq("profile_user_id", userId).eq("event_type", "search_appearance").gte("created_at", previousStartIso).lte("created_at", previousEndIso),
    ]);

    const distinctVisitors = new Set(
      (visitorsRes.data || []).map((r: any) => r.viewer_user_id).filter(Boolean)
    ).size;

    setOverview({
      postImpressions: impressionsCurrentRes.count || 0,
      postImpressionsTrend: trendPct(impressionsCurrentRes.count || 0, impressionsPreviousRes.count || 0),
      totalFollowers: followersRes.count || 0,
      visitors90d: distinctVisitors,
      searchAppearances7d: searchCurrentRes.count || 0,
      searchTrend: trendPct(searchCurrentRes.count || 0, searchPreviousRes.count || 0),
      currentRange: formatRange(currentStart, now, lang),
      previousRange: formatRange(previousStart, previousEnd, lang),
    });
    setOverviewLoading(false);
  };

  useEffect(() => {
    if (showOverview) fetchOverview();
  }, [showOverview]);

  if (!isOwner) return null;

  if (showOverview) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <button
          onClick={() => setShowOverview(false)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-body mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.dashboard.stats.title}
        </button>

        <h2 className="font-display text-2xl text-gray-900 mb-4">{t.dashboard.stats.overview}</h2>

        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-sm font-semibold text-gray-900 font-body">{t.dashboard.stats.trackPerformance}</h3>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label={t.dashboard.stats.metricDetails}>
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-3 text-sm">
              <div>
                <p className="font-semibold text-gray-900">{t.dashboard.stats.postImpressionsTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t.dashboard.stats.postImpressionsDesc}
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t.dashboard.stats.totalFollowersTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t.dashboard.stats.totalFollowersDesc}
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t.dashboard.stats.profileVisitorsTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t.dashboard.stats.profileVisitorsDesc}
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t.dashboard.stats.searchAppearancesTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t.dashboard.stats.searchAppearancesTitleDesc}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TrendCard
            value={overviewLoading ? "—" : overview.postImpressions}
            label={t.dashboard.stats.postImpressions7d}
            trend={overview.postImpressionsTrend}
            rangeLabel={t.dashboard.stats.vsLast7Days}
          />
          <TrendCard
            value={overviewLoading ? "—" : overview.totalFollowers}
            label={t.dashboard.stats.totalFollowersTitle}
            trend={0}
            rangeLabel={t.dashboard.stats.vsLast7Days}
          />
          <TrendCard
            value={overviewLoading ? "—" : overview.visitors90d}
            label={t.dashboard.stats.profileVisitors90d}
            trend={0}
            rangeLabel={t.dashboard.stats.vsLast7Days}
          />
          <TrendCard
            value={overviewLoading ? "—" : overview.searchAppearances7d}
            label={`${t.dashboard.stats.searchAppearancesIn} ${overview.currentRange}`}
            trend={overview.searchTrend}
            rangeLabel={`${t.dashboard.stats.vsRange} ${overview.previousRange}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="mb-1">
        <h2 className="font-display text-2xl text-gray-900">{t.dashboard.stats.title}</h2>
        <span className="text-gray-500 text-xs font-body">{t.dashboard.stats.confidential}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-500" />
            <span className="text-2xl font-bold text-gray-900">
              {loading ? "—" : profileViews}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 font-body">
            {t.dashboard.stats.profileViews}
          </p>
          <p className="text-xs text-gray-500 font-body">
            {t.dashboard.stats.profileViewsDesc}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-500" />
            <span className="text-2xl font-bold text-gray-900">
              {loading ? "—" : searchAppearances}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 font-body">
            {t.dashboard.stats.searchAppearances}
          </p>
          <p className="text-xs text-gray-500 font-body">
            {t.dashboard.stats.searchAppearancesDesc}
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 font-body">{t.dashboard.stats.last7Days}</p>

      <button
        onClick={() => setShowOverview(true)}
        className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-orange-500 font-body mt-4 pt-4 border-t border-gray-200 transition-colors"
      >
        {t.dashboard.stats.seeMore}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export default PlayerStats;
