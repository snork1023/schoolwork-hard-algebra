import { motion, useMotionValue, useSpring, useTransform, AnimatePresence, useScroll } from "motion/react";
import { Children, cloneElement, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import keplerLogo from "@/assets/kepler-logo.png";
import "./Dock.css";

type DockItemData = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void | Promise<void>;
  className?: string;
};

type DockProps = {
  items: DockItemData[];
  className?: string;
  distance?: number;
  panelHeight?: number;
  baseItemSize?: number;
  dockHeight?: number;
  magnification?: number;
  spring?: {
    mass?: number;
    stiffness?: number;
    damping?: number;
  };
};

function DockItem({
  children,
  className = "",
  onClick,
  mouseX,
  spring,
  distance,
  magnification,
  baseItemSize,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void | Promise<void>;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  spring: NonNullable<DockProps["spring"]>;
  distance: number;
  magnification: number;
  baseItemSize: number;
  label: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isHovered = useMotionValue(0);
  const [isClicked, setIsClicked] = useState(false);

  const mouseDistance = useTransform(mouseX, (val) => {
    if (isClicked || val === Infinity) return distance + 100;
    const rect = ref.current?.getBoundingClientRect() ?? {
      x: 0,
      width: baseItemSize,
    };
    return val - rect.x - baseItemSize / 2;
  });

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize]
  );
  const size = useSpring(targetSize, spring);

  const handleClick = async () => {
    if (isClicked) return;
    setIsClicked(true);
    mouseX.set(Infinity);
    isHovered.set(0);

    await onClick?.();

    setTimeout(() => {
      setIsClicked(false);
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <motion.div
      ref={ref}
      style={{
        width: size,
        height: size,
      }}
      onHoverStart={() => {
        if (!isClicked) isHovered.set(1);
      }}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => {
        if (!isClicked) isHovered.set(1);
      }}
      onBlur={() => isHovered.set(0)}
      onClick={handleClick}
      className={`dock-item ${className}`.trim()}
      tabIndex={0}
      role="button"
      aria-haspopup="true"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      {Children.map(children, (child) =>
        cloneElement(
          child as React.ReactNode & React.ReactElement<{ isHovered?: ReturnType<typeof useMotionValue<number>> }>,
          { isHovered }
        )
      )}
    </motion.div>
  );
}

function DockLabel({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  isHovered?: ReturnType<typeof useMotionValue<number>>;
}) {
  const { isHovered } = rest;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = isHovered?.on("change", (latest) => {
      setIsVisible(latest === 1);
    });
    return () => unsubscribe?.();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: 10 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className={`dock-label ${className}`.trim()}
          role="tooltip"
          style={{ x: "-50%" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`dock-icon ${className}`.trim()}>{children}</div>;
}

export default function Dock({
  items,
  className = "",
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 70,
  distance = 200,
  panelHeight = 68,
  dockHeight = 256,
  baseItemSize = 50,
}: DockProps) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const { scrollY } = useScroll();
  const [isHidden, setIsHidden] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      if (latest <= 0) {
        setIsHidden(false);
      } else {
        setIsHidden(true);
      }
    });
  }, [scrollY]);

  const maxHeight = useMemo(() => Math.max(dockHeight, magnification + magnification / 2 + 4), [magnification, dockHeight]);
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div 
      animate={{ 
        y: isHidden ? -100 : 0, 
        opacity: isHidden ? 0 : 1 
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      style={{ 
        position: "fixed",
        top: "16px",
        left: 0,
        right: 0,
        height, 
        scrollbarWidth: "none", 
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        zIndex: 9999,
        width: "100%",
      }} 
      className="dock-outer"
    >
      <div 
        className="flex items-center gap-2 z-10 ml-8 pointer-events-none"
        style={{
          position: "absolute",
          left: "10px",
          top: "14px",
        }}
      >
        <img src={keplerLogo} alt="Kepler" className="w-8 h-8 sm:w-9 sm:h-9" />
        <span
          className="text-sm sm:text-base font-semibold tracking-[0.2em] text-foreground"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          KEPLER
        </span>
      </div>

      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1);
          mouseX.set(pageX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={`dock-panel ${className}`.trim()}
        style={{ height: panelHeight, pointerEvents: "auto" }}
        role="toolbar"
        aria-label="Application dock"
      >
        {items.map((item, index) => (
          <DockItem
            key={index}
            onClick={item.onClick}
            className={item.className}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            label={item.label}
          >
            <DockIcon>{item.icon}</DockIcon>
            <DockLabel>{item.label}</DockLabel>
          </DockItem>
        ))}
      </motion.div>

      <div 
        className="flex items-center z-10 mr-8"
        style={{
          position: "absolute",
          right: "10px",
          top: "14px",
          pointerEvents: "none"
        }}
      >
        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center bg-transparent p-0 cursor-pointer"
            aria-label="Open navigation menu"
          >
            <div className="relative flex h-4 w-5 items-center justify-center">
              <span
                className={`absolute block h-0.5 w-5 rounded-full bg-foreground transition-all duration-200 dark:bg-white ${isMenuOpen ? "rotate-45" : "-translate-y-1"}`}
              />
              <span
                className={`absolute block h-0.5 w-5 rounded-full bg-foreground transition-all duration-200 dark:bg-white ${isMenuOpen ? "-rotate-45" : "translate-y-1"}`}
              />
            </div>
          </button>

          <div className={`absolute -right-2.5 top-full mt-4 w-44 overflow-hidden rounded-xl border border-border/70 bg-background/90 p-2 text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md transition-all duration-200 ease-out dark:border-[#222] dark:bg-[#120F17] dark:text-white dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${isMenuOpen ? "max-h-32 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2 pointer-events-none"}`}>
            <Link
              to="/privacypolicy"
              onClick={() => setIsMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-primary/20 dark:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              to="/termsofservice"
              onClick={() => setIsMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-primary/20 dark:text-white"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}