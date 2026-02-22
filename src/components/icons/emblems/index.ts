import type { FC } from "react";
import type { EmblemId } from "@/lib/icons/types";

import Lion from "./Lion";
import Eagle from "./Eagle";
import Wolf from "./Wolf";
import Bear from "./Bear";
import Hawk from "./Hawk";
import Snake from "./Snake";
import Dragon from "./Dragon";
import Basketball from "./Basketball";
import Football from "./Football";
import Baseball from "./Baseball";
import Soccer from "./Soccer";
import Trophy from "./Trophy";
import Lightning from "./Lightning";
import Flame from "./Flame";
import Star from "./Star";
import Crown from "./Crown";
import Sword from "./Sword";
import ShieldEmblem from "./ShieldEmblem";
import Bolt from "./Bolt";

/** Props accepted by every emblem component */
export interface EmblemProps {
  color: string;
}

/**
 * Lookup map from EmblemId to its React component.
 * Used by the UserIcon renderer to pick the correct emblem SVG.
 */
export const EMBLEM_COMPONENTS: Record<EmblemId, FC<EmblemProps>> = {
  // Animals
  lion: Lion,
  eagle: Eagle,
  wolf: Wolf,
  bear: Bear,
  hawk: Hawk,
  snake: Snake,
  dragon: Dragon,
  // Sports
  basketball: Basketball,
  football: Football,
  baseball: Baseball,
  soccer: Soccer,
  trophy: Trophy,
  lightning: Lightning,
  flame: Flame,
  // Symbols
  star: Star,
  crown: Crown,
  sword: Sword,
  "shield-emblem": ShieldEmblem,
  bolt: Bolt,
};
