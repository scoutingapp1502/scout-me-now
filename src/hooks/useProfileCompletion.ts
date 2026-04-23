import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileSection {
  key: string;
  labelRo: string;
  labelEn: string;
  completed: boolean;
  weight: number; // percentage points
}

export function useProfileCompletion(userId: string | null, role: "player" | "scout" | "agent" | "club_rep" | null) {
  const [sections, setSections] = useState<ProfileSection[]>([]);
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const handleProfileUpdated = () => {
      setRefreshToken((prev) => prev + 1);
    };

    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => window.removeEventListener("profile-updated", handleProfileUpdated);
  }, []);

  useEffect(() => {
    if (!userId || !role) {
      setSections([]);
      setPercentage(0);
      setLoading(false);
      return;
    }

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
            key: "video",
            labelRo: "Clipuri video",
            labelEn: "Video highlights",
            completed: !!(data.video_highlights && data.video_highlights.length > 0),
            weight: 35,
          },
          {
            key: "career",
            labelRo: "Carieră",
            labelEn: "Career",
            completed: !!data.career_description,
            weight: 25,
          },
          {
            key: "physical",
            labelRo: "Date fizice",
            labelEn: "Physical data",
            completed: !!(data.height_cm && data.weight_kg && data.preferred_foot),
            weight: 20,
          },
          {
            key: "photo",
            labelRo: "Fotografie de profil",
            labelEn: "Profile photo",
            completed: !!data.photo_url,
            weight: 5,
          },
          {
            key: "position",
            labelRo: "Poziție",
            labelEn: "Position",
            completed: !!data.position,
            weight: 5,
          },
          {
            key: "club",
            labelRo: "Club",
            labelEn: "Club",
            completed: !!data.current_team,
            weight: 2.5,
          },
          {
            key: "nationality",
            labelRo: "Naționalitate",
            labelEn: "Nationality",
            completed: !!data.nationality,
            weight: 2.5,
          },
          {
            key: "birth_date",
            labelRo: "Data nașterii",
            labelEn: "Date of birth",
            completed: !!data.date_of_birth,
            weight: 5,
          },
        ];

        setSections(s);
        setPercentage(s.reduce((acc, sec) => acc + (sec.completed ? sec.weight : 0), 0));
      } else if (role === "agent") {
        const [profileRes, expRes, certRes, manualPlayersRes, collabRes] = await Promise.all([
          supabase.from("scout_profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("scout_experiences").select("id, location").eq("user_id", userId).limit(1),
          supabase.from("scout_certifications").select("id").eq("user_id", userId).limit(1),
          supabase.from("agent_manual_players").select("id").eq("agent_user_id", userId).limit(1),
          supabase.from("agent_collaboration_requests").select("id").eq("agent_user_id", userId).eq("status", "accepted").limit(1),
        ]);

        const data = profileRes.data;
        if (!data) {
          setSections([]);
          setPercentage(0);
          setLoading(false);
          return;
        }

        const hasExperience = !!(expRes.data && expRes.data.length > 0);
        const hasLocation = !!(expRes.data && expRes.data.length > 0 && expRes.data[0].location);
        const hasCertification = !!(certRes.data && certRes.data.length > 0);
        const hasManualPlayers = !!(manualPlayersRes.data && manualPlayersRes.data.length > 0);
        const hasCollabs = !!(collabRes.data && collabRes.data.length > 0);
        const hasRepresentedPlayers = hasManualPlayers || hasCollabs;

        const s: ProfileSection[] = [
          {
            key: "certifications",
            labelRo: "Licențe și atestate",
            labelEn: "Certifications",
            completed: hasCertification,
            weight: 25,
          },
          {
            key: "represented_players",
            labelRo: "Jucători reprezentați",
            labelEn: "Represented players",
            completed: hasRepresentedPlayers,
            weight: 25,
          },
          {
            key: "experience",
            labelRo: "Experiență profesională",
            labelEn: "Professional experience",
            completed: hasExperience,
            weight: 20,
          },
          {
            key: "photo",
            labelRo: "Fotografie de profil",
            labelEn: "Profile photo",
            completed: !!data.photo_url,
            weight: 2.5,
          },
          {
            key: "title",
            labelRo: "Titlu",
            labelEn: "Title",
            completed: !!data.title,
            weight: 2.5,
          },
          {
            key: "organization",
            labelRo: "Organizație",
            labelEn: "Organization",
            completed: !!data.organization,
            weight: 2.5,
          },
          {
            key: "location",
            labelRo: "Locație",
            labelEn: "Location",
            completed: hasLocation,
            weight: 1.5,
          },
          {
            key: "cover",
            labelRo: "Fotografie de copertă",
            labelEn: "Cover photo",
            completed: !!data.cover_photo_url,
            weight: 1,
          },
          {
            key: "bio",
            labelRo: "Despre mine",
            labelEn: "About me",
            completed: !!(data.bio && data.bio.length > 10),
            weight: 10,
          },
          {
            key: "languages",
            labelRo: "Limbi cunoscute",
            labelEn: "Languages",
            completed: !!(data.languages && data.languages.length > 0),
            weight: 10,
          },
        ];

        setSections(s);
        setPercentage(s.reduce((acc, sec) => acc + (sec.completed ? sec.weight : 0), 0));
      } else {
        const [profileRes, expRes, postsRes, eduRes, certRes] = await Promise.all([
          supabase.from("scout_profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("scout_experiences").select("id").eq("user_id", userId).limit(1),
          supabase.from("scout_posts").select("id").eq("user_id", userId).limit(1),
          supabase.from("scout_education").select("id").eq("user_id", userId).limit(1),
          supabase.from("scout_certifications").select("id").eq("user_id", userId).limit(1),
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
            weight: 10,
          },
          {
            key: "basic",
            labelRo: "Informații de bază",
            labelEn: "Basic information",
            completed: !!(data.first_name && data.last_name && data.country),
            weight: 10,
          },
          {
            key: "cover",
            labelRo: "Fotografie de copertă",
            labelEn: "Cover photo",
            completed: !!data.cover_photo_url,
            weight: 5,
          },
          {
            key: "bio",
            labelRo: "Despre mine",
            labelEn: "About me",
            completed: !!(data.bio && data.bio.length > 10),
            weight: 10,
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
            weight: 10,
          },
          {
            key: "experience",
            labelRo: "Experiență profesională",
            labelEn: "Professional experience",
            completed: !!(expRes.data && expRes.data.length > 0),
            weight: 15,
          },
          {
            key: "education",
            labelRo: "Studii",
            labelEn: "Education",
            completed: !!(eduRes.data && eduRes.data.length > 0),
            weight: 10,
          },
          {
            key: "certifications",
            labelRo: "Licențe și atestate",
            labelEn: "Certifications",
            completed: !!(certRes.data && certRes.data.length > 0),
            weight: 10,
          },
          {
            key: "languages",
            labelRo: "Limbi cunoscute",
            labelEn: "Languages",
            completed: !!(data.languages && data.languages.length > 0),
            weight: 5,
          },
          {
            key: "activity",
            labelRo: "Activitate (postări)",
            labelEn: "Activity (posts)",
            completed: !!(postsRes.data && postsRes.data.length > 0),
            weight: 5,
          },
        ];

        setSections(s);
        setPercentage(s.reduce((acc, sec) => acc + (sec.completed ? sec.weight : 0), 0));
      }

      setLoading(false);
    };

    calculate();
  }, [userId, role, refreshToken]);

  return {
    sections,
    percentage,
    loading,
    refetch: () => setRefreshToken((prev) => prev + 1),
  };
}
