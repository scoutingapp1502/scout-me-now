// Utility to calculate profile completion percentage from raw data
// Used both by the hook (single user) and by list sections (bulk filtering)

export function calcPlayerCompletion(data: {
  photo_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  position?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  preferred_foot?: string | null;
  speed?: number | null;
  jumping?: number | null;
  endurance?: number | null;
  acceleration?: number | null;
  defense?: number | null;
  career_description?: string | null;
  current_team?: string | null;
  video_highlights?: string[] | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  twitter_url?: string | null;
}): number {
  let pct = 0;
  if (data.photo_url) pct += 15;
  if (data.first_name && data.last_name && data.nationality && data.date_of_birth && data.position) pct += 20;
  if (data.height_cm && data.weight_kg && data.preferred_foot) pct += 15;
  if (data.speed && data.jumping && data.endurance && data.acceleration && data.defense) pct += 15;
  if (data.career_description || data.current_team) pct += 15;
  if (data.video_highlights && data.video_highlights.length > 0) pct += 10;
  if (data.instagram_url || data.tiktok_url || data.twitter_url) pct += 10;
  return pct;
}

export function calcScoutCompletion(
  data: {
    photo_url?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    country?: string | null;
    cover_photo_url?: string | null;
    bio?: string | null;
    title?: string | null;
    organization?: string | null;
    skills?: string[] | null;
  },
  hasExperience: boolean,
  hasPost: boolean,
): number {
  let pct = 0;
  if (data.photo_url) pct += 15;
  if (data.first_name && data.last_name && data.country) pct += 15;
  if (data.cover_photo_url) pct += 10;
  if (data.bio && data.bio.length > 10) pct += 15;
  if (data.title || data.organization) pct += 10;
  if (data.skills && data.skills.length > 0) pct += 15;
  if (hasExperience) pct += 10;
  if (hasPost) pct += 10;
  return pct;
}
