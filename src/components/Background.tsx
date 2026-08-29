import DarkVeil from "./DarkVeil";
import { useSettingsContext } from "@/components/SettingsProvider";

const FALLBACK_HUE = 263;

const parseHue = (accentColor: string): number => {
  const match = accentColor.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : FALLBACK_HUE;
};

const Background = () => {
  const { settings } = useSettingsContext();

  const accentHue = parseHue(settings.accentColor);
  const resolvedHueShift = settings.veilHueShift ?? accentHue;

  return (
    <div
      className="fixed top-0 left-0 w-screen h-screen pointer-events-none overflow-hidden blur-[var(--veil-blur,0px)] brightness-[var(--veil-brightness-light,1)] dark:brightness-[var(--veil-brightness-dark,1)]"
      style={{ zIndex: 0 }}
    >
      <DarkVeil
        speed={settings.veilSpeed}
        hueShift={resolvedHueShift}
        warpAmount={settings.veilWarpAmount}
      />
    </div>
  );
};

export default Background;