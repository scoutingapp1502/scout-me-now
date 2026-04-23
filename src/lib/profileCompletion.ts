// Utility to calculate profile completion percentage from raw data
// Used both by the hook (single user) and by list sections (bulk filtering)

export function calcPlayerCompletion(data: {
  photo_url?: string | null;
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
  if (data.video_highlights && data.video_highlights.length > 0) pct += 35;
  if (data.career_description) pct += 25;
  if (data.height_cm && data.weight_kg && data.preferred_foot) pct += 20;
  if (data.photo_url) pct += 5;
  if (data.position) pct += 5;
  if (data.current_team) pct += 2.5;
  if (data.nationality) pct += 2.5;
  if (data.date_of_birth) pct += 5;
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
    languages?: string[] | null;
  },
  hasExperience: boolean,
  hasPost: boolean,
  hasEducation: boolean,
  hasCertification: boolean,
): number {
  let pct = 0;
  if (data.photo_url) pct += 10;
  if (data.first_name && data.last_name && data.country) pct += 10;
  if (data.cover_photo_url) pct += 5;
  if (data.bio && data.bio.length > 10) pct += 10;
  if (data.title || data.organization) pct += 10;
  if (data.skills && data.skills.length > 0) pct += 10;
  if (hasExperience) pct += 15;
  if (hasEducation) pct += 10;
  if (hasCertification) pct += 10;
  if (data.languages && data.languages.length > 0) pct += 5;
  if (hasPost) pct += 5;
  return pct;
}

export function calcAgentCompletion(
  data: {
    photo_url?: string | null;
    title?: string | null;
    organization?: string | null;
    cover_photo_url?: string | null;
    bio?: string | null;
    languages?: string[] | null;
  },
  hasExperience: boolean,
  hasCertification: boolean,
  hasRepresentedPlayers: boolean,
  hasLocation: boolean,
): number {
  let pct = 0;
  if (hasCertification) pct += 25;
  if (hasRepresentedPlayers) pct += 25;
  if (hasExperience) pct += 20;
  if (data.photo_url) pct += 2.5;
  if (data.title) pct += 2.5;
  if (data.organization) pct += 2.5;
  if (hasLocation) pct += 1.5;
  if (data.cover_photo_url) pct += 1;
  if (data.bio && data.bio.length > 10) pct += 10;
  if (data.languages && data.languages.length > 0) pct += 10;
  return pct;
}

export function calcClubRepCompletion(
  data: {
    first_name?: string | null;
    last_name?: string | null;
    title?: string | null;
    organization?: string | null;
    country?: string | null;
    bio?: string | null;
    languages?: string[] | null;
  },
  hasExperience: boolean,
  hasCertification: boolean,
  hasPost: boolean,
): number {
  let pct = 0;
  if (data.first_name) pct += 2.5;
  if (data.last_name) pct += 2.5;
  if (data.title) pct += 10;
  if (data.organization) pct += 10;
  if (data.country) pct += 5;
  if (data.bio && data.bio.length > 10) pct += 10;
  if (hasCertification) pct += 10;
  if (hasExperience) pct += 30;
  if (data.languages && data.languages.length > 0) pct += 10;
  if (hasPost) pct += 10;
  return pct;
}
