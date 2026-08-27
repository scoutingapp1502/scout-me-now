import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Language } from "@/i18n/translations";

export interface AnnouncementTranslation {
  title: string;
  content: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  image_url: string | null;
  video_url: string | null;
  document_urls: string[];
  translations: Record<string, AnnouncementTranslation>;
}

export interface AnnouncementFields {
  title?: string;
  content?: string;
  is_active?: boolean;
  image_url?: string | null;
  video_url?: string | null;
  document_urls?: string[];
  translations?: Record<string, AnnouncementTranslation>;
}

export function useAnnouncements(activeOnly: boolean = true) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("announcements")
      .select("id, title, content, is_active, created_at, image_url, video_url, document_urls, translations")
      .order("created_at", { ascending: false });
    if (activeOnly) query = query.eq("is_active", true);
    const { data } = await query;
    setAnnouncements(data || []);
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createAnnouncement = async (fields: AnnouncementFields & { title: string; content: string }, adminUserId: string) => {
    const { error } = await (supabase as any)
      .from("announcements")
      .insert({ ...fields, created_by: adminUserId });
    if (!error) await fetchAll();
    return { error };
  };

  const updateAnnouncement = async (id: string, fields: AnnouncementFields) => {
    const { error } = await (supabase as any)
      .from("announcements")
      .update(fields)
      .eq("id", id);
    if (!error) await fetchAll();
    return { error };
  };

  const removeAnnouncement = async (id: string) => {
    const { error } = await (supabase as any)
      .from("announcements")
      .delete()
      .eq("id", id);
    if (!error) await fetchAll();
    return { error };
  };

  return { announcements, loading, createAnnouncement, updateAnnouncement, removeAnnouncement, refetch: fetchAll };
}

/** Resolves the title/content to display for an announcement in the given language, falling back to the base (Romanian) text when no translation was provided. */
export function getAnnouncementText(a: Announcement, lang: Language): AnnouncementTranslation {
  if (lang === "ro") return { title: a.title, content: a.content };
  const tr = a.translations?.[lang];
  return {
    title: tr?.title?.trim() ? tr.title : a.title,
    content: tr?.content?.trim() ? tr.content : a.content,
  };
}
