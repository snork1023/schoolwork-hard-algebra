import React, {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import {
  animate,
  motion,
  motionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import "./radio.css";

export interface RadioItem {
  value: string;
  label?: ReactNode;
  color?: string;
  content?: ReactNode;
  disabled?: boolean;
}

export type RadioValue = string | RadioItem;

interface RadioProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "value"
  > {
  items: RadioValue[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, index: number) => void;
  size?: "sm" | "md" | "lg";
  shape?: "circle" | "pill";
  gap?: number;
  swell?: number;
  barge?: number;
  shrink?: number;
  jelly?: number;
  bounce?: number;
  stagger?: number;
  stiffness?: number;
  className?: string;
  ariaLabel?: string;
}

const SIZES = {
  sm: 28,
  md: 32,
  lg: 40,
};

const spring = (
  stiffness: number,
  mass: number,
  bounce: number
) => ({
  type: "spring" as const,
  stiffness,
  damping:
    2 * Math.sqrt(stiffness * mass) * (1 - bounce),
  mass,
});

type RadioMotionValues = {
  x: ReturnType<typeof motionValue<number>>;
  sx: ReturnType<typeof motionValue<number>>;
  sy: ReturnType<typeof motionValue<number>>;
};

const RadioCircle = ({
  values,
  selected,
  color,
  label,
  content,
}: {
  values: RadioMotionValues;
  selected: boolean;
  color?: string;
  label?: ReactNode;
  content?: ReactNode;
}) => {
  const transform = useTransform(
    [values.x, values.sx, values.sy],
    ([x, sx, sy]) => `translateX(${x}px) scale(${sx}, ${sy})`,
  );

  return (
    <motion.span
      className="radio__circle"
      style={{
        transform,
        backgroundColor: color ?? "hsl(var(--muted))",
      }}
      data-on={selected ? "true" : "false"}
    >
      {content ? (
        <span className="radio__content">{content}</span>
      ) : (
        label && !selected && <span className="radio__label">{label}</span>
      )}
    </motion.span>
  );
};

const Radio = ({
  items,
  value,
  defaultValue,
  onChange,
  size = "md",
  shape = "circle",
  gap = 8,
  swell = 0.18,
  barge = 4,
  shrink = 0.03,
  jelly = 1,
  bounce = 0.2,
  stagger = 18,
  stiffness = 580,
  disabled = false,
  className = "",
  ariaLabel = "Options",
  ...buttonProps
}: RadioProps) => {
  const list: RadioItem[] = items.map((item) =>
    typeof item === "string"
      ? {
          value: item,
          label: item,
        }
      : item
  );

  const [inner, setInner] = useState(
    defaultValue ?? list[0]?.value
  );

  const current = value ?? inner;

  const selectedIndex = Math.max(
    0,
    list.findIndex(
      (item) => item.value === current
    )
  );

  const reduce = useReducedMotion();

  const itemRefs = useRef<
    Array<HTMLButtonElement | null>
  >([]);

  const mvs = useRef<RadioMotionValues[]>([]);

  const applied = useRef(selectedIndex);

  const mvFor = (index: number) => {
    if (!mvs.current[index]) {
      mvs.current[index] = {
        x: motionValue(0),
        sx: motionValue(1),
        sy: motionValue(1),
      };
    }

    return mvs.current[index];
  };

  const apply = (
    selected: number,
    instant = false
  ) => {
    for (let i = 0; i < list.length; i++) {
      const mv = mvFor(i);

      const isSelected = i === selected;
      const distance = Math.abs(i - selected);
      const direction = Math.sign(i - selected);

      const push =
        swell * 18 + barge;

      const x = direction * push;

      const scale = isSelected
        ? 1 + swell
        : 1 - shrink;

      if (instant || reduce) {
        mv.x.jump(x);
        mv.sx.jump(scale);
        mv.sy.jump(scale);
        continue;
      }

      const k =
        stiffness *
        (1 - 0.1 * Math.min(distance, 3));

      const delay =
        (distance * stagger) / 1000;

      animate(mv.x, x, {
        ...spring(k, 0.8, bounce),
        delay,
      });

      animate(mv.sx, scale, {
        ...spring(
          k * (1 + 0.2 * jelly),
          0.8,
          Math.min(
            0.85,
            bounce + 0.25 * jelly
          )
        ),
        delay,
      });

      animate(mv.sy, scale, {
        ...spring(
          k * (1 - 0.12 * jelly),
          0.85,
          bounce
        ),
        delay: delay + 0.04 * jelly,
      });
    }
  };

  useEffect(() => {
    apply(selectedIndex, true);
  }, []);

  useEffect(() => {
    if (applied.current === selectedIndex) {
      return;
    }

    applied.current = selectedIndex;
    apply(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    return () => {
      mvs.current.forEach((mv) => {
        mv.x.destroy();
        mv.sx.destroy();
        mv.sy.destroy();
      });
    };
  }, []);

  const commit = (index: number) => {
    const item = list[index];

    if (
      disabled ||
      !item ||
      item.disabled ||
      index === selectedIndex
    ) {
      return;
    }

    applied.current = index;

    apply(index);

    if (value === undefined) {
      setInner(item.value);
    }

    onChange?.(item.value, index);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let next = index;

    if (
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      next = (index + 1) % list.length;
    } else if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp"
    ) {
      next =
        (index - 1 + list.length) %
        list.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = list.length - 1;
    } else if (
      event.key === " " ||
      event.key === "Enter"
    ) {
      next = index;
    } else {
      return;
    }

    event.preventDefault();

    if (!list[next]?.disabled) {
      commit(next);
      itemRefs.current[next]?.focus();
    }
  };

  const circleSize = SIZES[size];

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-disabled={
        disabled ? "" : undefined
      }
      data-shape={shape}
      className={`radio ${className}`}
      style={
        {
          "--radio-gap": `${gap}px`,
          "--radio-size": `${circleSize}px`,
        } as React.CSSProperties
      }
    >
      {/* The motion values are lazily created for each option's animated child. */}
      {/* eslint-disable-next-line react-hooks/refs -- create stable motion values for options */}
      {list.map((item, index) => {
        const selected =
          index === selectedIndex;

        return (
          <button
            key={item.value}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={
              typeof item.label === "string"
                ? item.label
                : item.value
            }
            tabIndex={selected ? 0 : -1}
            disabled={
              disabled || !!item.disabled
            }
            className="radio__chip"
            onClick={() => commit(index)}
            onKeyDown={(event) =>
              handleKeyDown(event, index)
            }
            {...buttonProps}
          >
            <RadioCircle
              values={mvFor(index)}
              selected={selected}
              color={item.color}
              label={item.label}
              content={item.content}
            />
          </button>
        );
      })}
    </div>
  );
};

export default Radio;