import ElasticSlider from "@/components/ElasticSlider";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RotateCcw, Minus, Plus } from "lucide-react";

const DARKVEIL_PRESETS = {
  speed: 1,
  warpAmount: 0.8,
};

const parseAccentHue = (accentColor: string): number => {
  const match = accentColor.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : 263;
};

const BackgroundEffectSettings = () => {
  const { settings, updateSettings } = useUserSettings();

  const handleReset = () => {
    updateSettings({
      veilSpeed: DARKVEIL_PRESETS.speed,
      veilHueShift: null,
      veilWarpAmount: DARKVEIL_PRESETS.warpAmount,
    });
  };

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between">
        <Label>Effect Settings</Label>
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-6">
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium relative -top-1">Speed</p>
          <ElasticSlider
            className="!w-full"
            startingValue={0}
            maxValue={4}
            defaultValue={settings.veilSpeed ?? DARKVEIL_PRESETS.speed}
            isStepped
            stepSize={0.1}
            leftIcon={<Minus className="h-3.5 w-3.5" />}
            rightIcon={<Plus className="h-3.5 w-3.5" />}
            formatValue={(v) => `${v.toFixed(1)}x`}
            onChange={(value) => updateSettings({ veilSpeed: value })}
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium relative -top-1">Hue</p>
          <ElasticSlider
            className="!w-full"
            startingValue={0}
            maxValue={360}
            defaultValue={settings.veilHueShift ?? parseAccentHue(settings.accentColor)}
            isStepped
            stepSize={1}
            leftIcon={<Minus className="h-3.5 w-3.5" />}
            rightIcon={<Plus className="h-3.5 w-3.5" />}
            formatValue={(v) => `${Math.round(v)}°`}
            onChange={(value) => updateSettings({ veilHueShift: value })}
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium relative -top-1">Warp</p>
          <ElasticSlider
            className="!w-full"
            startingValue={0}
            maxValue={5}
            defaultValue={settings.veilWarpAmount ?? DARKVEIL_PRESETS.warpAmount}
            isStepped
            stepSize={0.1}
            leftIcon={<Minus className="h-3.5 w-3.5" />}
            rightIcon={<Plus className="h-3.5 w-3.5" />}
            formatValue={(v) => v.toFixed(1)}
            onChange={(value) => updateSettings({ veilWarpAmount: value })}
          />
        </div>
      </div>
    </div>
  );
};

export default BackgroundEffectSettings;