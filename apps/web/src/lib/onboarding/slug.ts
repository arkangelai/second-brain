import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeTeamSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "team";
}

export function slugFromTeamName(name: string): string {
  return normalizeTeamSlug(name);
}

export async function findAvailableTeamSlug(
  supabase: SupabaseClient,
  requestedSlug: string
): Promise<string> {
  const baseSlug = normalizeTeamSlug(requestedSlug);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabase
      .from("teams")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}
