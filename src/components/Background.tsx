import DarkVeil from "./DarkVeil";
import { useSettingsContext } from "@/components/SettingsProvider";

const FALLBACK_HUE = 263;

// Extracts the hue degree from an HSL string like "263 70% 50%"
const parseHue = (accentColor: string): number => {
  const match = accentColor.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : FALLBACK_HUE;
};

const Background = () => {
  const { settings } = useSettingsContext();

  const accentHue = parseHue(settings.accentColor);
  const resolvedHueShift = settings.veilHueShift ?? accentHue;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0, transform: "translateY(20px) scale(1.05)" }}>
      <DarkVeil
        speed={settings.veilSpeed}
        hueShift={resolvedHueShift}
        warpAmount={settings.veilWarpAmount}
      />
    </div>
  );
};

export default Background;