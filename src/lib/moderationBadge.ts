// Maps a piece of content's moderation_status to what its OWNER sees.
// Never shown to anyone else — a non-owner viewer only ever receives rows
// RLS/get_activity_feed already resolved to 'approved' in the first place.
export function moderationBadgeLabel(
  status: string | null | undefined,
  lang: string
): { label: string; className: string } | null {
  if (status === "pending") {
    return { label: lang === "ro" ? "În verificare" : "Under review", className: "bg-yellow-500 text-white" };
  }
  if (status === "flagged") {
    return { label: lang === "ro" ? "Necesită verificare" : "Needs review", className: "bg-orange-500 text-white" };
  }
  if (status === "rejected") {
    return { label: lang === "ro" ? "Respins" : "Rejected", className: "bg-red-600 text-white" };
  }
  return null;
}
