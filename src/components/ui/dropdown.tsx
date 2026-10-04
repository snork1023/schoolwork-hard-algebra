import * as React from "react";
import { createPortal } from "react-dom";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import "./dropdown.css";

export interface DropdownOption {
  value: string;
  label: ReactNode;
  tag?: string;
}

interface DropdownSelectProps {
  options: (string | DropdownOption)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, option: DropdownOption) => void;
  placeholder?: string;
  showTags?: boolean;
  accentColor?: string;
  surfaceColor?: string;
  highlightColor?: string;
  textColor?: string;
  size?: "sm" | "md" | "lg";
  radius?: number;
  menuWidth?: number;
  placement?: "top" | "bottom";
  align?: "left" | "right";
  popDuration?: number;
  glideDuration?: number;
  rememberPosition?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  triggerContent?: ReactNode;
  footer?: ReactNode;
}

type DropdownMenuRootProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Root
> & { options?: never };

export type DropdownProps = DropdownSelectProps | DropdownMenuRootProps;

type Phase = "closed" | "open" | "closing";

const SIZES = {
  sm: { chip: 28, row: 26, font: 12 },
  md: { chip: 32, row: 30, font: 13 },
  lg: { chip: 44, row: 40, font: 14 },
};
const PAD = 4;
const GAP = 1;
const MENU_GAP = 6;

const normalizeOption = (
  option: string | DropdownOption,
): DropdownOption =>
  typeof option === "string"
    ? { value: option, label: option }
    : option;

const optionText = (option: DropdownOption) =>
  typeof option.label === "string" ? option.label : option.value;

const findTypeaheadOption = (
  options: DropdownOption[],
  from: number,
  character: string,
) => {
  const query = character.toLowerCase();
  for (let offset = 1; offset <= options.length; offset++) {
    const index = (from + offset) % options.length;
    if (optionText(options[index]).toLowerCase().startsWith(query)) {
      return index;
    }
  }
  return from;
};

const DropdownSelect = ({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = "Select...",
  showTags = true,
  accentColor = "hsl(var(--primary))",
  surfaceColor = "hsl(var(--popover))",
  highlightColor = "hsl(var(--primary))",
  textColor = "hsl(var(--popover-foreground))",
  size = "md",
  radius = 10,
  menuWidth,
  placement = "bottom",
  align = "left",
  popDuration = 180,
  glideDuration = 120,
  rememberPosition = true,
  disabled = false,
  ariaLabel = "Select",
  className,
  triggerClassName,
  triggerContent,
  footer,
}: DropdownSelectProps) => {
  const items = options.map(normalizeOption);
  const [innerValue, setInnerValue] = useState(defaultValue ?? "");
  const current = value ?? innerValue;
  const selectedIndex = items.findIndex((item) => item.value === current);
  const [phase, setPhase] = useState<Phase>("closed");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [side, setSide] = useState<"top" | "bottom">(placement);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const instant = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>();
  const pointer = useRef<{ id: number; top: number } | null>(null);
  const id = useId();
  const dimensions = SIZES[size];
  const step = dimensions.row + GAP;
  const popOutDuration = Math.round((popDuration * 2) / 3);
  const dropdownStyle = {
    "--gd-surface": surfaceColor,
    "--gd-highlight": highlightColor,
    "--gd-text": textColor,
    "--gd-accent": accentColor,
    "--gd-radius": `${radius}px`,
    "--gd-inner-radius": `${Math.max(3, radius - 4)}px`,
    "--gd-pop-duration": `${popDuration}ms`,
    "--gd-pop-out-duration": `${popOutDuration}ms`,
    "--gd-glide-duration": `${glideDuration}ms`,
    "--gd-ease": "cubic-bezier(0.23, 1, 0.32, 1)",
    "--gd-row": `${dimensions.row}px`,
    "--gd-chip": `${dimensions.chip}px`,
    "--gd-font": `${dimensions.font}px`,
    "--gd-menu-width": menuWidth ? `${menuWidth}px` : undefined,
  } as CSSProperties;

  const close = React.useCallback((animated: boolean) => {
    setActiveIndex(null);
    clearTimeout(closeTimer.current);
    const menu = menuRef.current;
    if (!animated || !menu) {
      setPhase("closed");
      return;
    }
    menu.dataset.state = "closed";
    setPhase("closing");
    closeTimer.current = setTimeout(
      () => setPhase("closed"),
      popOutDuration + 20,
    );
  }, [popOutDuration]);

  const open = (viaKeyboard: boolean) => {
    if (disabled || items.length === 0) return;
    clearTimeout(closeTimer.current);
    instant.current = true;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : viaKeyboard ? 0 : null);
    setPhase("open");
  };

  const pick = (index: number, viaKeyboard: boolean) => {
    const option = items[index];
    if (!option) {
      close(false);
      return;
    }
    if (option.value !== current) {
      if (value === undefined) setInnerValue(option.value);
      onChange?.(option.value, option);
      if (!viaKeyboard && rootRef.current) {
        rootRef.current.dataset.swap = "";
      }
    }
    close(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (phase !== "open") return;
    const menu = menuRef.current;
    const root = rootRef.current;
    if (!menu || !root) return;

    const rect = root.getBoundingClientRect();
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;
    const menuHeight = menu.offsetHeight;
    const nextSide =
      placement === "bottom" &&
      rect.bottom + menuHeight + MENU_GAP > window.innerHeight
        ? "top"
        : placement === "top" && rect.top - menuHeight - MENU_GAP < 0
          ? "bottom"
          : placement;
    const width = menuWidth ?? triggerRect.width;
    const left = Math.max(
      8,
      Math.min(
        align === "right" ? triggerRect.right - width : triggerRect.left,
        window.innerWidth - width - 8,
      ),
    );
    const top =
      nextSide === "bottom"
        ? Math.min(
            triggerRect.bottom + MENU_GAP,
            window.innerHeight - menuHeight - 8,
          )
        : Math.max(8, triggerRect.top - menuHeight - MENU_GAP);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.width = `${width}px`;
    setSide(nextSide);
    menu.dataset.state = "closed";
    void menu.offsetHeight;
    menu.dataset.state = "open";

    const pill = pillRef.current;
    if (pill) {
      pill.style.transition = "none";
      pill.style.transform = `translateY(${Math.max(0, selectedIndex) * step}px)`;
      pill.style.opacity = "0";
      void pill.offsetHeight;
      pill.style.transition = "";
    }
  }, [align, menuWidth, phase, placement, selectedIndex, step]);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill || phase !== "open") return;
    if (activeIndex === null) {
      pill.style.opacity = "0";
      instant.current = false;
      return;
    }
    if (instant.current) {
      pill.style.transition = "none";
      pill.style.transform = `translateY(${activeIndex * step}px)`;
      void pill.offsetHeight;
      pill.style.transition = "";
      instant.current = false;
    } else {
      pill.style.transform = `translateY(${activeIndex * step}px)`;
    }
    pill.style.opacity = "1";
  }, [activeIndex, phase, step]);

  useEffect(() => {
    if (phase === "closed") return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [close, phase]);

  useEffect(() => {
    if (!disabled || phase === "closed") return;
    const timer = setTimeout(() => close(false), 0);
    return () => clearTimeout(timer);
  }, [close, disabled, phase]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const activeOptionAt = (clientY: number) => {
    if (!pointer.current) return null;
    const index = Math.floor(
      (clientY - pointer.current.top - PAD) / step,
    );
    return index >= 0 && index < items.length ? index : null;
  };

  const onTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    const key = event.key;
    const currentIndex = activeIndex ?? Math.max(0, selectedIndex);

    if (phase !== "open") {
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        open(true);
      }
      return;
    }

    const setActive = (index: number) => {
      event.preventDefault();
      setActiveIndex(Math.min(items.length - 1, Math.max(0, index)));
    };

    if (key === "ArrowDown" || key === "ArrowUp") {
      setActive(currentIndex + (key === "ArrowDown" ? 1 : -1));
    } else if (key === "Home" || key === "End") {
      setActive(key === "Home" ? 0 : items.length - 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      pick(currentIndex, true);
    } else if (key === "Escape" || key === "Tab") {
      if (key === "Escape") event.preventDefault();
      close(false);
    } else if (
      key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      setActive(findTypeaheadOption(items, currentIndex, key));
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn("glide-dropdown", className)}
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      style={dropdownStyle}
      onAnimationEnd={(event) => {
        if (
          event.animationName === "gs-swap" &&
          rootRef.current
        ) {
          delete rootRef.current.dataset.swap;
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={phase === "open"}
        aria-controls={`${id}-list`}
        aria-activedescendant={
          activeIndex !== null ? `${id}-${activeIndex}` : undefined
        }
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          "glide-dropdown__trigger",
          triggerClassName,
        )}
        onClick={(event) => {
          if (event.detail === 0 && phase === "open") return;
          if (phase === "open") close(true);
          else open(false);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <div
          className="glide-dropdown__label"
          key={current}
          data-empty={selectedIndex < 0 ? "" : undefined}
        >
          {triggerContent ??
            (selectedIndex >= 0 ? items[selectedIndex].label : placeholder)}
        </div>
        <ChevronDown
          className="glide-dropdown__chevron"
          aria-hidden="true"
        />
      </button>
      {phase !== "closed" &&
        createPortal(
          <div
          ref={menuRef}
          className="glide-dropdown__menu"
          data-state={phase === "closing" ? "closed" : "open"}
          data-side={side}
          data-align={align}
          style={dropdownStyle}
        >
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            className="glide-dropdown__list"
            data-live={activeIndex !== null ? "" : undefined}
            onPointerOver={(event) => {
              if (event.pointerType === "touch" || pointer.current) return;
              const row = (event.target as HTMLElement).closest<HTMLElement>(
                "[data-index]",
              );
              if (!row) return;
              const index = Number(row.dataset.index);
              if (index !== activeIndex) setActiveIndex(index);
            }}
            onPointerLeave={() => {
              if (!pointer.current && !rememberPosition) {
                setActiveIndex(null);
              }
            }}
            onPointerDown={(event) => {
              if (pointer.current) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              pointer.current = {
                id: event.pointerId,
                top: event.currentTarget.getBoundingClientRect().top,
              };
              setActiveIndex(activeOptionAt(event.clientY));
            }}
            onPointerMove={(event) => {
              if (pointer.current?.id !== event.pointerId) return;
              const index = activeOptionAt(event.clientY);
              if (index !== activeIndex) setActiveIndex(index);
            }}
            onPointerUp={(event) => {
              if (pointer.current?.id !== event.pointerId) return;
              const index = activeOptionAt(event.clientY);
              pointer.current = null;
              if (index !== null) pick(index, false);
            }}
            onPointerCancel={() => {
              pointer.current = null;
            }}
            onLostPointerCapture={() => {
              pointer.current = null;
            }}
          >
            <span
              ref={pillRef}
              className="glide-dropdown__pill"
              aria-hidden="true"
            />
            {items.map((item, index) => (
              <div
                key={item.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                data-index={index}
                className="glide-dropdown__option"
              >
                <div className="glide-dropdown__name">{item.label}</div>
                {showTags && item.tag && (
                  <span className="glide-dropdown__tag">{item.tag}</span>
                )}
                <span
                  className="glide-dropdown__check"
                  data-on={index === selectedIndex ? "" : undefined}
                  aria-hidden="true"
                >
                  <Check size={14} strokeWidth={2.5} />
                </span>
              </div>
            ))}
          </div>
          {footer && (
            <div className="glide-dropdown__footer">{footer}</div>
          )}
          </div>,
          document.body,
        )}
    </div>
  );
};

const Dropdown = (props: DropdownProps) =>
  "options" in props && props.options ? (
    <DropdownSelect {...props} />
  ) : (
    <DropdownMenuPrimitive.Root {...props} />
  );

const DropdownTrigger = DropdownMenuPrimitive.Trigger;
const DropdownGroup = DropdownMenuPrimitive.Group;
const DropdownPortal = DropdownMenuPrimitive.Portal;
const DropdownSub = DropdownMenuPrimitive.Sub;
const DropdownRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      {...props}
      className={cn("glide-dropdown-menu", className)}
      style={{ ...props.style, zIndex: 2147483647 }}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    {...props}
    className={cn("glide-dropdown-menu", className)}
    style={{ ...props.style, zIndex: 2147483647 }}
  />
));
DropdownSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn("glide-dropdown-menu__item", inset && "pl-8", className)}
    {...props}
  />
));
DropdownItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn("glide-dropdown-menu__check-item", className)}
    checked={checked}
    {...props}
  >
    <span className="glide-dropdown-menu__indicator">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn("glide-dropdown-menu__check-item", className)}
    {...props}
  >
    <span className="glide-dropdown-menu__indicator">
      <DropdownMenuPrimitive.ItemIndicator>
        <span className="h-2 w-2 rounded-full bg-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "glide-dropdown-menu__item",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
    {...props}
  />
);
DropdownShortcut.displayName = "DropdownShortcut";

export {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownCheckboxItem,
  DropdownRadioItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownShortcut,
  DropdownGroup,
  DropdownPortal,
  DropdownSub,
  DropdownSubContent,
  DropdownSubTrigger,
  DropdownRadioGroup,
};
