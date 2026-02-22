"use client";

import { useState } from "react";
import { Shuffle, Loader2 } from "lucide-react";

import type { IconConfig, IconShape, EmblemId } from "@/lib/icons/types";
import {
  BG_COLORS,
  BORDER_COLORS,
  EMBLEM_COLORS,
} from "@/lib/icons/constants";
import {
  generateRandomIcon,
  generateRandomIconPure,
} from "@/lib/icons/generator";

import UserIcon from "../UserIcon";
import ShapePicker from "./ShapePicker";
import { ColorPicker } from "./ColorPicker";
import EmblemPicker from "./EmblemPicker";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/* ---------- Props ---------- */

interface IconBuilderProps {
  /** Existing icon config to edit. If null, a random config is generated from userId. */
  initialConfig: IconConfig | null;
  /** The current user's ID — used to seed the initial random config when initialConfig is null. */
  userId: string;
  /** Callback invoked with the final config when the user clicks Save. */
  onSave: (config: IconConfig) => Promise<void>;
  /** When true, the Save button shows a spinner and is disabled. */
  saving?: boolean;
}

/* ---------- Component ---------- */

export default function IconBuilder({
  initialConfig,
  userId,
  onSave,
  saving = false,
}: IconBuilderProps) {
  const [config, setConfig] = useState<IconConfig>(
    () => initialConfig ?? generateRandomIcon(userId)
  );

  /* --- Individual field updaters --- */

  const setShape = (shape: IconShape) =>
    setConfig((prev) => ({ ...prev, shape }));

  const setBgColor = (bgColor: string) =>
    setConfig((prev) => ({ ...prev, bgColor }));

  const setBorderColor = (borderColor: string) =>
    setConfig((prev) => ({ ...prev, borderColor }));

  const setEmblemId = (emblemId: EmblemId) =>
    setConfig((prev) => ({ ...prev, emblemId }));

  const setEmblemColor = (emblemColor: string) =>
    setConfig((prev) => ({ ...prev, emblemColor }));

  /* --- Randomize handler --- */

  const handleRandomize = () => {
    setConfig(generateRandomIconPure());
  };

  /* --- Save handler --- */

  const handleSave = () => {
    onSave(config);
  };

  /* --- Render --- */

  return (
    <div className="space-y-4">
      {/* Live preview + Randomize */}
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <UserIcon config={config} size={128} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Live Preview</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRandomize}
          >
            <Shuffle className="size-4" />
            Randomize
          </Button>
        </div>
      </div>

      <Separator />

      {/* Shape picker */}
      <ShapePicker
        selected={config.shape}
        bgColor={config.bgColor}
        borderColor={config.borderColor}
        onSelect={setShape}
      />

      <Separator />

      {/* Background color */}
      <ColorPicker
        colors={BG_COLORS}
        selected={config.bgColor}
        onSelect={setBgColor}
        label="Background Color"
      />

      <Separator />

      {/* Border color */}
      <ColorPicker
        colors={BORDER_COLORS}
        selected={config.borderColor}
        onSelect={setBorderColor}
        label="Border Color"
      />

      <Separator />

      {/* Emblem picker */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Emblem</p>
        <EmblemPicker
          selected={config.emblemId}
          emblemColor={config.emblemColor}
          onSelect={setEmblemId}
        />
      </div>

      <Separator />

      {/* Emblem color */}
      <ColorPicker
        colors={EMBLEM_COLORS}
        selected={config.emblemColor}
        onSelect={setEmblemColor}
        label="Emblem Color"
      />

      <Separator />

      {/* Save button */}
      <Button
        type="button"
        className="w-full"
        onClick={handleSave}
        disabled={saving}
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? "Saving..." : "Save Icon"}
      </Button>
    </div>
  );
}
