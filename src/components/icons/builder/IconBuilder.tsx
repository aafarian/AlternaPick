"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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

  /** Tracks whether the preview should flash (opacity dip) on changes */
  const [previewFlash, setPreviewFlash] = useState(false);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Trigger a brief opacity flash on the preview */
  const triggerFlash = useCallback(() => {
    setPreviewFlash(true);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setPreviewFlash(false), 150);
  }, []);

  /** Clean up timeout on unmount */
  useEffect(() => {
    return () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, []);

  /* --- Individual field updaters --- */

  const setShape = (shape: IconShape) => {
    setConfig((prev) => ({ ...prev, shape }));
    triggerFlash();
  };

  const setBgColor = (bgColor: string) => {
    setConfig((prev) => ({ ...prev, bgColor }));
    triggerFlash();
  };

  const setBorderColor = (borderColor: string) => {
    setConfig((prev) => ({ ...prev, borderColor }));
    triggerFlash();
  };

  const setEmblemId = (emblemId: EmblemId) => {
    setConfig((prev) => ({ ...prev, emblemId }));
    triggerFlash();
  };

  const setEmblemColor = (emblemColor: string) => {
    setConfig((prev) => ({ ...prev, emblemColor }));
    triggerFlash();
  };

  /* --- Randomize handler --- */

  const handleRandomize = () => {
    setConfig(generateRandomIconPure());
    triggerFlash();
  };

  /* --- Save handler --- */

  const handleSave = async () => {
    await onSave(config);
  };

  /* --- Render --- */

  return (
    <div className="space-y-4">
      {/* Live preview + Randomize */}
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <UserIcon
            config={config}
            size={128}
            className={`transition-opacity duration-150 ${previewFlash ? "opacity-70" : "opacity-100"}`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground" id="icon-preview-label">
            Live Preview
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRandomize}
            aria-label="Randomize icon configuration"
          >
            <Shuffle className="size-4" aria-hidden="true" />
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
        collapsible
      />

      <Separator />

      {/* Border color */}
      <ColorPicker
        colors={BORDER_COLORS}
        selected={config.borderColor}
        onSelect={setBorderColor}
        label="Border Color"
        collapsible
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
        collapsible
      />

      <Separator />

      {/* Save button */}
      <Button
        type="button"
        className="w-full"
        onClick={handleSave}
        disabled={saving}
        aria-label={saving ? "Saving icon" : "Save icon"}
      >
        {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {saving ? "Saving..." : "Save Icon"}
      </Button>
    </div>
  );
}
