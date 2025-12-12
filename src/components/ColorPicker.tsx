import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus } from "lucide-react";

interface ColorPickerProps {
  value: string | null;
  onChange: (hsl: string) => void;
  isSelected: boolean;
}

const hslToHex = (h: number, s: number, l: number): string => {
  const hDecimal = h / 360;
  const sDecimal = s / 100;
  const lDecimal = l / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (sDecimal === 0) {
    r = g = b = lDecimal;
  } else {
    const q = lDecimal < 0.5 ? lDecimal * (1 + sDecimal) : lDecimal + sDecimal - lDecimal * sDecimal;
    const p = 2 * lDecimal - q;
    r = hue2rgb(p, q, hDecimal + 1 / 3);
    g = hue2rgb(p, q, hDecimal);
    b = hue2rgb(p, q, hDecimal - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 50 };

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const parseHslString = (hsl: string): { h: number; s: number; l: number } => {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return { h: 0, s: 100, l: 50 };
  return { h: parseInt(parts[1]), s: parseInt(parts[2]), l: parseInt(parts[3]) };
};

export default function ColorPicker({ value, onChange, isSelected }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const [hexInput, setHexInput] = useState("#808080");
  
  const shadeBoxRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const [isDraggingShade, setIsDraggingShade] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  useEffect(() => {
    if (value) {
      const { h, s, l } = parseHslString(value);
      setHue(h);
      setSaturation(s);
      setLightness(l);
      setHexInput(hslToHex(h, s, l));
    }
  }, [value]);

  const updateColor = (h: number, s: number, l: number) => {
    setHue(h);
    setSaturation(s);
    setLightness(l);
    const hex = hslToHex(h, s, l);
    setHexInput(hex);
    onChange(`${h} ${s}% ${l}%`);
  };

  const handleShadeBoxClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!shadeBoxRef.current) return;
    const rect = shadeBoxRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    const s = Math.round(x * 100);
    const l = Math.round((1 - y) * 50 + (1 - x) * (1 - y) * 50);
    
    updateColor(hue, s, l);
  };

  const handleHueSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const h = Math.round(y * 360);
    updateColor(h, saturation, lightness);
  };

  const handleHexChange = (hex: string) => {
    setHexInput(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const { h, s, l } = hexToHsl(hex);
      updateColor(h, s, l);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingShade && shadeBoxRef.current) {
        const rect = shadeBoxRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const s = Math.round(x * 100);
        const l = Math.round((1 - y) * 50 + (1 - x) * (1 - y) * 50);
        updateColor(hue, s, l);
      }
      if (isDraggingHue && hueSliderRef.current) {
        const rect = hueSliderRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const h = Math.round(y * 360);
        updateColor(h, saturation, lightness);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingShade(false);
      setIsDraggingHue(false);
    };

    if (isDraggingShade || isDraggingHue) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingShade, isDraggingHue, hue, saturation, lightness]);

  const shadeX = saturation / 100;
  const shadeY = 1 - (lightness - (1 - saturation / 100) * 50) / 50;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-8 h-8 rounded-full transition-all hover:scale-110 flex items-center justify-center border-2 border-dashed border-muted-foreground/50 ${
            isSelected ? "ring-2 ring-offset-2 ring-offset-background ring-foreground" : ""
          }`}
          style={{
            backgroundColor: value ? `hsl(${value})` : "hsl(var(--muted))",
            borderStyle: value ? "solid" : "dashed",
            borderColor: value ? "transparent" : undefined,
          }}
        >
          {!value && <Plus className="h-4 w-4 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 bg-popover border-border" align="end">
        <div className="flex gap-3">
          {/* Shade/Saturation Box */}
          <div
            ref={shadeBoxRef}
            className="w-48 h-48 rounded-lg cursor-crosshair relative select-none"
            style={{
              background: `
                linear-gradient(to bottom, transparent, black),
                linear-gradient(to right, white, hsl(${hue}, 100%, 50%))
              `,
            }}
            onClick={handleShadeBoxClick}
            onMouseDown={() => setIsDraggingShade(true)}
          >
            {/* Picker indicator */}
            <div
              className="absolute w-4 h-4 border-2 border-white rounded-full shadow-md pointer-events-none"
              style={{
                left: `${shadeX * 100}%`,
                top: `${Math.max(0, Math.min(1, shadeY)) * 100}%`,
                transform: "translate(-50%, -50%)",
                backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
              }}
            />
          </div>

          {/* Hue Slider */}
          <div
            ref={hueSliderRef}
            className="w-4 h-48 rounded-lg cursor-pointer relative select-none"
            style={{
              background: `linear-gradient(to bottom, 
                hsl(0, 100%, 50%), 
                hsl(60, 100%, 50%), 
                hsl(120, 100%, 50%), 
                hsl(180, 100%, 50%), 
                hsl(240, 100%, 50%), 
                hsl(300, 100%, 50%), 
                hsl(360, 100%, 50%)
              )`,
            }}
            onClick={handleHueSliderClick}
            onMouseDown={() => setIsDraggingHue(true)}
          >
            {/* Hue indicator */}
            <div
              className="absolute w-6 h-2 -left-1 border-2 border-white rounded-sm shadow-md pointer-events-none"
              style={{
                top: `${(hue / 360) * 100}%`,
                transform: "translateY(-50%)",
                backgroundColor: `hsl(${hue}, 100%, 50%)`,
              }}
            />
          </div>
        </div>

        {/* Hex Input */}
        <div className="mt-4 flex items-center gap-2">
          <div
            className="w-8 h-8 rounded border border-border"
            style={{ backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)` }}
          />
          <Input
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            className="font-mono text-sm uppercase"
            placeholder="#000000"
            maxLength={7}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}