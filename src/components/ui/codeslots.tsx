import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { OTPInputContext } from "input-otp";

import { InputOTP, InputOTPGroup } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

export type CodeSlotsStatus = "idle" | "success" | "error";

type CodeSlotsProps = Omit<
  React.ComponentPropsWithoutRef<typeof InputOTP>,
  "maxLength" | "value" | "onChange" | "children" | "render"
> & {
  length?: number;
  value?: string;
  status?: CodeSlotsStatus;
  onChange?: (value: string) => void;
  onComplete?: (code: string) => void | Promise<void>;
  accentColor?: string;
  inkColor?: string;
  slotColor?: string;
  digitColor?: string;
  dangerColor?: string;
  slotSize?: number;
  gap?: number;
  radius?: number;
  settle?: number;
  rise?: number;
};

type CodeDigitSlotProps = {
  index: number;
  showCaret: boolean;
  delayCaret: boolean;
  inkColor: string;
  slotColor: string;
  digitColor: string;
  borderColor: string;
  slotSize: number;
  radius: number;
  settle: number;
  rise: number;
};

function CodeDigitSlot({
  index,
  showCaret,
  delayCaret,
  inkColor,
  slotColor,
  digitColor,
  borderColor,
  slotSize,
  radius,
  settle,
  rise,
}: CodeDigitSlotProps) {
  const { slots } = React.useContext(OTPInputContext);
  const { char } = slots[index];

  return (
    <div
      className="relative flex items-center justify-center border text-lg font-medium transition-colors"
      style={{
        width: slotSize,
        height: slotSize,
        borderRadius: radius,
        borderColor,
        backgroundColor: slotColor,
        color: digitColor,
      }}
    >
      <AnimatePresence initial={false}>
        {char && (
          <motion.span
            key={`${index}-${char}`}
            initial={{ y: rise, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: rise, opacity: 0 }}
            transition={{ duration: settle, ease: "easeOut" }}
          >
            {char}
          </motion.span>
        )}
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={cn("h-5 w-px transition-opacity", showCaret && "animate-caret-blink duration-1000")}
          style={{
            backgroundColor: inkColor,
            opacity: showCaret ? 1 : 0,
            transitionDuration: "50ms",
            transitionDelay: showCaret && delayCaret ? "45ms" : "0ms",
          }}
        />
      </div>
    </div>
  );
}

function CodeSlotsGroup({
  length,
  gap,
  slotSize,
  radius,
  settle,
  rise,
  slotColor,
  digitColor,
  borderColor,
  inkColor,
  delayCaret,
}: {
  length: number;
  gap: number;
  slotSize: number;
  radius: number;
  settle: number;
  rise: number;
  slotColor: string;
  digitColor: string;
  borderColor: string;
  inkColor: string;
  delayCaret: boolean;
}) {
  const { slots } = React.useContext(OTPInputContext);
  const activeSlotIndex = slots.findIndex((slot) => slot.hasFakeCaret);

  return (
    <InputOTPGroup className="justify-center" style={{ gap }}>
      {Array.from({ length }, (_, index) => (
        <CodeDigitSlot
          key={index}
          index={index}
          showCaret={activeSlotIndex === index}
          delayCaret={delayCaret}
          inkColor={inkColor}
          slotColor={slotColor}
          digitColor={digitColor}
          borderColor={borderColor}
          slotSize={slotSize}
          radius={radius}
          settle={settle}
          rise={rise}
        />
      ))}
    </InputOTPGroup>
  );
}

function CodeSlots({
  length = 6,
  value,
  status = "idle",
  onChange,
  onComplete,
  accentColor = "hsl(var(--ring))",
  inkColor = "hsl(var(--foreground))",
  slotColor = "hsl(var(--background))",
  digitColor = "hsl(var(--foreground))",
  dangerColor = "hsl(var(--destructive))",
  slotSize = 44,
  gap = 8,
  radius = 12,
  settle = 0.1,
  rise = 8,
  className,
  ...props
}: CodeSlotsProps) {
  const [internalValue, setInternalValue] = React.useState("");
  const [delayCaret, setDelayCaret] = React.useState(false);
  const lastCompletedRef = React.useRef("");
  const caretDelayTimeoutRef = React.useRef<number | null>(null);
  const currentValue = value ?? internalValue;
  const borderColor = status === "error" ? dangerColor : accentColor;

  React.useEffect(
    () => () => {
      if (caretDelayTimeoutRef.current !== null) {
        window.clearTimeout(caretDelayTimeoutRef.current);
      }
    },
    [],
  );

  const handleChange = (nextValue: string) => {
    const numericValue = nextValue.replace(/\D/g, "").slice(0, length);
    const deleting = numericValue.length < currentValue.length;
    if (caretDelayTimeoutRef.current !== null) {
      window.clearTimeout(caretDelayTimeoutRef.current);
      caretDelayTimeoutRef.current = null;
    }
    setDelayCaret(deleting);
    if (deleting) {
      caretDelayTimeoutRef.current = window.setTimeout(() => {
        setDelayCaret(false);
        caretDelayTimeoutRef.current = null;
      }, 60);
    }
    if (value === undefined) setInternalValue(numericValue);
    onChange?.(numericValue);

    if (numericValue.length < length) {
      lastCompletedRef.current = "";
    } else if (lastCompletedRef.current !== numericValue) {
      lastCompletedRef.current = numericValue;
      void onComplete?.(numericValue);
    }
  };

  return (
    <InputOTP
      {...props}
      maxLength={length}
      value={currentValue}
      onChange={handleChange}
      inputMode="numeric"
      pattern="[0-9]*"
      className={cn("w-full", className)}
      containerClassName={cn("w-full justify-center", props.containerClassName)}
      aria-invalid={status === "error" || undefined}
    >
      <CodeSlotsGroup
        length={length}
        gap={gap}
        slotSize={slotSize}
        radius={radius}
        settle={settle}
        rise={rise}
        slotColor={slotColor}
        digitColor={digitColor}
        borderColor={borderColor}
        inkColor={inkColor}
        delayCaret={delayCaret}
      />
    </InputOTP>
  );
}

export default CodeSlots;
