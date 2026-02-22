import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { SHAPES, EMBLEM_IDS, BG_COLORS, BORDER_COLORS, EMBLEM_COLORS } from "@/lib/icons/constants";
import type { IconConfig, IconShape, EmblemId } from "@/lib/icons/types";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate an incoming payload against the IconConfig shape.
 * Returns a validated IconConfig or a string describing the error.
 */
function validateIconConfig(
  body: unknown
): { ok: true; config: IconConfig } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const obj = body as Record<string, unknown>;

  // -- shape --
  if (
    typeof obj.shape !== "string" ||
    !SHAPES.includes(obj.shape as IconShape)
  ) {
    return {
      ok: false,
      error: `Invalid shape. Must be one of: ${SHAPES.join(", ")}`,
    };
  }

  // -- emblemId --
  if (
    typeof obj.emblemId !== "string" ||
    !EMBLEM_IDS.includes(obj.emblemId as EmblemId)
  ) {
    return {
      ok: false,
      error: `Invalid emblemId. Must be one of: ${EMBLEM_IDS.join(", ")}`,
    };
  }

  // -- colors (hex format check) --
  for (const field of ["bgColor", "borderColor", "emblemColor"] as const) {
    const val = obj[field];
    if (typeof val !== "string" || !HEX_COLOR_RE.test(val)) {
      return {
        ok: false,
        error: `Invalid ${field}. Must be a hex color string (e.g. "#1a1a2e")`,
      };
    }
  }

  // -- colors (palette membership check) --
  if (!BG_COLORS.includes(obj.bgColor as string)) {
    return { ok: false, error: "bgColor is not in the allowed palette" };
  }
  if (!BORDER_COLORS.includes(obj.borderColor as string)) {
    return { ok: false, error: "borderColor is not in the allowed palette" };
  }
  if (!EMBLEM_COLORS.includes(obj.emblemColor as string)) {
    return { ok: false, error: "emblemColor is not in the allowed palette" };
  }

  return {
    ok: true,
    config: {
      shape: obj.shape as IconShape,
      bgColor: obj.bgColor as string,
      borderColor: obj.borderColor as string,
      emblemId: obj.emblemId as EmblemId,
      emblemColor: obj.emblemColor as string,
    },
  };
}

/**
 * PUT /api/profile/icon
 * Save an icon config to the authenticated user's profile.
 * Clears avatar_url when an icon config is saved (user chose icon over image).
 *
 * Body: IconConfig JSON — { shape, bgColor, borderColor, emblemId, emblemColor }
 * Returns: { success: true, config: IconConfig }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const body: unknown = await request.json();
    const result = validateIconConfig(body);

    if (!result.ok) {
      return badRequest(result.error);
    }

    const { config } = result;

    const { error: updateError } = await typedFrom(supabase, "profiles")
      .update({
        icon_config: config as unknown as Record<string, unknown>,
        avatar_url: null,
      })
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, config });
  } catch (error) {
    return handleApiError(error, "Failed to save icon config");
  }
}
