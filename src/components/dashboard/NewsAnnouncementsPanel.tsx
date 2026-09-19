import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAnnouncements, getAnnouncementText, type Announcement } from "@/hooks/useAnnouncements";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText } from "lucide-react";
import { SignedImg, SignedVideo, SignedLink } from "@/components/SignedSrc";
import type { Language } from "@/i18n/translations";

const getFileName = (url: string) => {
  try {
    const raw = decodeURIComponent(url.split("/").pop() || "");
    return raw.replace(/^\d+-[a-z0-9]+\./, "") || raw;
  } catch {
    return "Document";
  }
};

const LOCALE_BY_LANG: Record<Language, string> = {
  ro: "ro-RO", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT",
};

const VISIBLE_COUNT = 5;

export default function NewsAnnouncementsPanel() {
  const { lang } = useLanguage();
  const { announcements, loading } = useAnnouncements(true);
  const [openAnnouncement, setOpenAnnouncement] = useState<Announcement | null>(null);
  const [showAll, setShowAll] = useState(false);

  const ordered = [...announcements].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const visibleAnnouncements = showAll ? ordered : ordered.slice(0, VISIBLE_COUNT);
  const hasMore = ordered.length > VISIBLE_COUNT;

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-display text-sm text-gray-900 uppercase tracking-wide mb-2">
        {lang === "ro" ? "Știri și anunțuri" : "News & announcements"}
      </h3>
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : announcements.length === 0 ? (
        <p className="text-xs text-gray-500">
          {lang === "ro" ? "Momentan nu sunt știri sau anunțuri disponibile." : "No news or announcements yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {visibleAnnouncements.map((a) => {
            const text = getAnnouncementText(a, lang);
            return (
              <div key={a.id} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold text-gray-900">{text.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{text.content}</p>
                <button
                  type="button"
                  onClick={() => setOpenAnnouncement(a)}
                  className="text-[11px] font-medium text-orange-500 hover:text-orange-600 hover:underline mt-1"
                >
                  {lang === "ro" ? "Vezi mai mult" : "See more"}
                </button>
                <p className="text-[10px] text-gray-400 mt-1">
                  {new Date(a.created_at).toLocaleDateString(LOCALE_BY_LANG[lang], { day: "numeric", month: "short" })}
                </p>
              </div>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline pt-1"
            >
              {showAll
                ? (lang === "ro" ? "Vezi mai puține" : "See less")
                : (lang === "ro" ? "Vezi mai multe" : "See more")}
            </button>
          )}
        </div>
      )}

      <Dialog open={!!openAnnouncement} onOpenChange={(open) => !open && setOpenAnnouncement(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-white border-gray-200">
          {openAnnouncement && (() => {
            const text = getAnnouncementText(openAnnouncement, lang);
            return (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-lg text-gray-900 pr-6">{text.title}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-gray-400 -mt-2">
                {new Date(openAnnouncement.created_at).toLocaleDateString(LOCALE_BY_LANG[lang], { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{text.content}</p>
              {openAnnouncement.image_url && (
                <SignedImg src={openAnnouncement.image_url} alt="" className="w-full rounded-lg object-cover" />
              )}
              {openAnnouncement.video_url && (
                <SignedVideo src={openAnnouncement.video_url} className="w-full rounded-lg" controls />
              )}
              {openAnnouncement.document_urls?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {openAnnouncement.document_urls.map((url) => (
                    <SignedLink
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-orange-600 hover:underline bg-gray-100 rounded-full px-2.5 py-1.5 max-w-full"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{getFileName(url)}</span>
                    </SignedLink>
                  ))}
                </div>
              )}
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
