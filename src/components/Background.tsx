import DarkVeil from "./DarkVeil";
import { useSettingsContext } from "@/components/SettingsProvider";

const Background = () => {
  const { settings } = useSettingsContext();

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0, transform: "translateY(0)" }}>
      <DarkVeil
        speed={settings.veilSpeed}
        hueShift={settings.veilHueShift}
        warpAmount={settings.veilWarpAmount}
      />
    </div>
  );
};

export default Background;