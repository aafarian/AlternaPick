import type { FC } from "react";
import type { EmblemId } from "@/lib/icons/types";
import type { EmblemProps } from "./types";

import Lion from "./Lion";
import Eagle from "./Eagle";
import Wolf from "./Wolf";
import Bear from "./Bear";
import Hawk from "./Hawk";
import Snake from "./Snake";
import Dragon from "./Dragon";
import Paw from "./Paw";
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
import Mountain from "./Mountain";
import Anchor from "./Anchor";
import Rocket from "./Rocket";
import Gem from "./Gem";

export type { EmblemProps } from "./types";

/**
 * Lookup map from EmblemId to its React component.
 * Used by the UserIcon renderer to pick the correct emblem SVG.
 */
export const EMBLEM_COMPONENTS: Record<EmblemId, FC<EmblemProps>> = {
  lion: Lion,
  eagle: Eagle,
  wolf: Wolf,
  bear: Bear,
  hawk: Hawk,
  snake: Snake,
  dragon: Dragon,
  paw: Paw,
  basketball: Basketball,
  football: Football,
  baseball: Baseball,
  soccer: Soccer,
  trophy: Trophy,
  lightning: Lightning,
  flame: Flame,
  star: Star,
  crown: Crown,
  sword: Sword,
  "shield-emblem": ShieldEmblem,
  bolt: Bolt,
  mountain: Mountain,
  anchor: Anchor,
  rocket: Rocket,
  gem: Gem,
};
