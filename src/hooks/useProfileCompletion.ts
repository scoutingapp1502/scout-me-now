import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileSection {
  key: string;
  labelRo: string;
  labelEn: string;
  completed: boolean;
  weight: number; // percentage points
}

export function useProfileCompletion(userId: string | null, role: "player" | "scout" | null) {
  const [sections, setSections] = useState<ProfileSection[]>([]);
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !role) return;

    const calculate = async () => {
      setLoading(true);

      if (role === "player") {
        const { data } = await supabase
          .from("player_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!data) {
          setSections([]);
          setPercentage(0);
          setLoading(false);
          return;
        }

        const s: ProfileSection[] = [
          {
            key: "photo",
            labelRo: "Fotografie de profil",
            labelEn: "Profile photo",
            completed: !!data.photo_url,
            weight: 15,
          },
          {
            key: "basic",
            labelRo: "Informații de bază",
            labelEn: "Basic information",
            completed: !!(data.first_name && data.last_name && data.nationality && data.date_of_birth && data.position),
            weight: 20,
          },
          {
            key: "physical",
            labelRo: "Date fizice",
            labelEn: "Physical data",
            completed: !!(data.height_cm && data.weight_kg && data.preferred_foot),
            weight: 15,
          },
          {
            key: "stats",
            labelRo: "Atribute atletice",
            labelEn: "Athletic attributes",
            completed: !!(data.speed && data.jumping && data.endurance && data.acceleration && data.defense),
            weight: 15,
          },
          {
            key: "career",
            labelRo: "Carieră & Echipă",
            labelEn: "Career & Team",
            completed: !!(data.career_description || data.current_team),
            weight: 15,
          },
          {
            key: "video",
            labelRo: "Clipuri video",
            labelEn: "Video highlights",
            completed: !!(data.video_highlights && data.video_highlights.length > 0),
            weight: 10,
          },
          {
            key: "social",
            labelRo: "Social media",
            labelEn: "Social media",
            completed: !!(data.instagram_url || data.tiktok_url || data.twitter_url),
            weight: 10,
          },
        ];

        setSections(s);
        setPercentage(s.reduce((acc, sec) => acc + (sec.completed ? sec.weight : 0), 0));
      } else {
        // Scout
        const [profileRes, expRes, postsRes] = await Promise.all([
          supabase.from("scout_profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("scout_experiences").select("id").eq("user_id", userId).limit(1),
          supabase.from("scout_posts").select("id").eq("user_id", userId).limit(1),
        ]);

        const data = profileRes.data;
        if (!data) {
          setSections([]);
          setPercentage(0);
          setLoading(false);
          return;
        }

        const s: ProfileSection[] = [
          {
            key: "photo",
            labelRo: "Fotografie de profil",
            labelEn: "Profile photo",
            completed: !!data.photo_url,
            weight: 15,
          },
          {
            key: "basic",
            labelRo: "Informații de bază",
            labelEn: "Basic information",
            completed: !!(data.first_name && data.last_name && data.country),
            weight: 15,
          },
          {
            key: "cover",
            labelRo: "Fotografie de copertă",
            labelEn: "Cover photo",
            completed: !!data.cover_photo_url,
            weight: 10,
          },
          {
            key: "bio",
            labelRo: "Despre mine",
            labelEn: "About me",
            completed: !!(data.bio && data.bio.length > 10),
            weight: 15,
          },
          {
            key: "title",
            labelRo: "Titlu / Organizație",
            labelEn: "Title / Organization",
            completed: !!(data.title || data.organization),
            weight: 10,
          },
          {
            key: "skills",
            labelRo: "Aptitudini de top",
            labelEn: "Top skills",
            completed: !!(data.skills && data.skills.length > 0),
            weight: 15,
          },
          {
            key: "experience",
            labelRo: "Experiență profesională",
            labelEn: "Professional experience",
            completed: !!(expRes.data && expRes.data.length > 0),
            weight: 10,
          },
          {
            key: "activity",
            labelRo: "Activitate (postări)",
            labelEn: "Activity (posts)",
            completed: !!(postsRes.data && postsRes.data.length > 0),
            weight: 10,
          },
        ];

        setSections(s);
        setPercentage(s.reduce((acc, sec) => acc + (sec.completed ? sec.weight : 0), 0));
      }

      setLoading(false);
    };

    calculate();
  }, [userId, role]);

  return { sections, percentage, loading, refetch: () => {
    // Trigger re-calculation by toggling loading
    if (userId && role) {
      setLoading(true);
      // Re-run by changing a dep - we'll just call the effect manually
      const event = new Event("profile-updated");
      window.dispatchEvent(event);
    }
  }};
}
