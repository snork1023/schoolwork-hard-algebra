import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform
} from 'motion/react';
import { X } from 'lucide-react';

import './toast.css';

export type ToastCloseReason =
  | 'timeout'
  | 'swipe'
  | 'action'
  | 'close'
  | 'escape'
  | 'programmatic';

export type ToastFuse = 'bottom' | 'top' | 'none';

export type ToastVariant =
  | 'default'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'destructive';

export type ToastPhase =
  | 'open'
  | 'closing'
  | 'gone';

export interface ToastProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actionLabel?: ReactNode;
  onAction?: () => void;

  open?: boolean;
  onClose?: (reason: ToastCloseReason) => void;

  variant?: ToastVariant;

  background?: string;
  color?: string;
  fuseColor?: string;

  width?: number;
  radius?: number;
  slideMs?: number;
  settleBounce?: number;
  swipeDistance?: number;
  duration?: number;
  fuse?: ToastFuse;

  pauseOnHover?: boolean;
  closeButton?: boolean;
  inline?: boolean;
  dismissible?: boolean;
  className?: string;
}

type Sample = [number, number];

interface Drag {
  id: number;
  startY: number;
  grab: number | null;
  moved: boolean;
  hist: Sample[];
}

interface Latest {
  onClose?: (reason: ToastCloseReason) => void;
  onAction?: () => void;
  slideMs: number;
  inline: boolean;
}

const EASE_OUT: [number, number, number, number] = [
  0.23,
  1,
  0.32,
  1
];

const FLICK = 0.11;
const DEAD_ZONE = 3;
const RESIST_PX = 24;
const COLLAPSE_MS = 200;
const EXIT = 0.7;

const BURN = [
  { transform: 'scaleX(1)' },
  { transform: 'scaleX(0)' }
];

const HAS_STARTING_STYLE =
  typeof window !== 'undefined' &&
  'CSSStartingStyleRule' in window;

const rubberband = (
  over: number,
  dim: number,
  c = 0.55
) =>
  (over * dim * c) /
  (dim + c * Math.abs(over));

const velocityOf = (hist: Sample[]) => {
  if (hist.length < 2) return 0;

  const [t0, y0] = hist[0];
  const [t1, y1] =
    hist[hist.length - 1];

  return performance.now() - t1 > 100
    ? 0
    : (y1 - y0) /
      Math.max(1, t1 - t0);
};

const Toast: React.FC<ToastProps> = ({
  title = '',
  description = '',
  icon,
  actionLabel = '',
  onAction,

  open = true,
  onClose,

  variant = 'default',

  background,
  color,
  fuseColor,

  width = 400,
  radius = 14,
  slideMs = 300,
  settleBounce = .2,
  swipeDistance = 40,
  duration = 4000,
  fuse = 'bottom',

  pauseOnHover = false,
  closeButton = true,
  inline = false,
  dismissible = true,
  className = ''
}) => {
  const reduce = useReducedMotion();

  const [phase, setPhase] =
    useState<ToastPhase>('open');

  const [instant, setInstant] =
    useState(false);

  const [mounted, setMounted] =
    useState(HAS_STARTING_STYLE);

  const cardRef =
    useRef<HTMLDivElement>(null);

  const fuseRef =
    useRef<HTMLElement>(null);

  const anim =
    useRef<Animation | null>(null);

  const drag =
    useRef<Drag | null>(null);

  const flags =
    useRef({
      hover: false,
      interacting: false,
      focus: false,
      hidden: false
    });

  const lastInput =
    useRef<'pointer' | 'keyboard'>(
      'pointer'
    );

  const pendingClose =
    useRef<ToastCloseReason | null>(
      null
    );

  const closeTimer =
    useRef<
      ReturnType<typeof setTimeout> | undefined
    >(undefined);

  const leaving =
    useRef(false);

  const phaseRef =
    useRef<ToastPhase>(phase);

  const latest =
    useRef<Latest>({} as Latest);

  useLayoutEffect(() => {
    phaseRef.current = phase;
    latest.current = {
      onClose,
      onAction,
      slideMs,
      inline
    };
  }, [phase, onClose, onAction, slideMs, inline]);

  const y = useMotionValue(0);
  const fade = useMotionValue(1);

  const transform =
    useTransform(
      y,
      value => `translateY(${value}px)`
    );

  const variantFuseColors: Record<
    ToastVariant,
    string
  > = {
    default: 'hsl(var(--primary-glow))',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    destructive:
      'hsl(var(--destructive))'
  };

  const resolvedBackground =
    background ??
    'hsl(var(--popover))';

  const resolvedColor =
    color ??
    'hsl(var(--primary-foreground-glow))';

  const resolvedFuseColor =
    fuseColor ??
    variantFuseColors[variant];

  const syncFuse = () => {
    const animation = anim.current;

    if (!animation) return;

    const f = flags.current;

    if (
      f.hover ||
      f.interacting ||
      f.focus ||
      f.hidden
    ) {
      animation.pause();
    } else if (
      animation.playState === 'paused'
    ) {
      animation.play();
    }
  };

  const finish = (
    why: ToastCloseReason
  ) => {
    setPhase('gone');
    leaving.current = false;

    if (latest.current.inline) {
      closeTimer.current =
        setTimeout(() => {
          latest.current.onClose?.(
            why
          );
        }, COLLAPSE_MS);
    } else {
      latest.current.onClose?.(why);
    }
  };

  const close = (
    why: ToastCloseReason
  ) => {
    if (
      phaseRef.current !== 'open' ||
      leaving.current
    ) {
      return;
    }

    if (drag.current) {
      pendingClose.current = why;
      return;
    }

    anim.current?.pause();

    const now =
      why === 'escape' ||
      (
        (why === 'action' ||
          why === 'close') &&
        lastInput.current ===
          'keyboard'
      );

    setInstant(now);
    setPhase('closing');

    clearTimeout(closeTimer.current);

    closeTimer.current =
      setTimeout(
        () => finish(why),
        now
          ? 0
          : latest.current.slideMs *
              EXIT +
            60
      );
  };

  const rescue = () => {
    clearTimeout(closeTimer.current);

    setInstant(false);
    y.set(0);
    fade.set(1);
    setPhase('open');
  };

  useEffect(() => {
    if (!open) {
      close('programmatic');
    } else if (
      phaseRef.current !== 'open'
    ) {
      rescue();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!HAS_STARTING_STYLE) {
      requestAnimationFrame(() =>
        setMounted(true)
      );
    }
  }, []);

  useEffect(() => {
    if (
      phase !== 'open' ||
      duration <= 0 ||
      !fuseRef.current
    ) {
      return undefined;
    }

    anim.current?.cancel();

    const animation =
      fuseRef.current.animate(
        BURN,
        {
          duration,
          easing: 'linear',
          fill: 'forwards'
        }
      );

    animation.onfinish = () =>
      close('timeout');

    anim.current = animation;

    syncFuse();

    return () => {
      animation.onfinish = null;
      animation.pause();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, duration]);

  useEffect(() => {
    if (!pauseOnHover) {
      flags.current.hover = false;
      syncFuse();
    }

     
  }, [pauseOnHover]);

  useEffect(() => {
    const onVisibility = () => {
      flags.current.hidden =
        document.hidden;

      syncFuse();
    };

    document.addEventListener(
      'visibilitychange',
      onVisibility
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        onVisibility
      );

      clearTimeout(
        closeTimer.current
      );

      anim.current?.cancel();
    };

     
  }, []);

  const swipeOut = (
    dy: number,
    velocity: number
  ) => {
    anim.current?.pause();

    leaving.current = true;
    pendingClose.current = null;

    if (
      !reduce &&
      cardRef.current
    ) {
      animate(
        y,
        dy +
          cardRef.current
            .offsetHeight,
        {
          type: 'spring',
          duration: 0.3,
          bounce: 0,
          velocity:
            velocity * 1000
        }
      );
    }

    animate(
      fade,
      0,
      {
        duration: 0.2,
        ease: EASE_OUT
      }
    ).then(() => {
      finish('swipe');
    });
  };

  const onPointerDown = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    lastInput.current =
      'pointer';

    if (
      e.button !== 0 ||
      !dismissible ||
      drag.current ||
      leaving.current ||
      (
        e.target as HTMLElement
      ).closest('button')
    ) {
      return;
    }

    if (
      phaseRef.current ===
      'closing'
    ) {
      rescue();
    }

    try {
      cardRef.current?.setPointerCapture(
        e.pointerId
      );
    } catch {
      // The pointer capture can already be released when the toast closes.
    }

    y.stop();

    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      grab: null,
      moved: false,
      hist: [
        [
          performance.now(),
          y.get()
        ]
      ]
    };

    flags.current.interacting =
      true;

    syncFuse();
  };

  const onPointerMove = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const d = drag.current;

    if (
      !d ||
      d.id !== e.pointerId
    ) {
      return;
    }

    if (d.grab === null) {
      if (
        Math.abs(
          e.clientY - d.startY
        ) < DEAD_ZONE
      ) {
        return;
      }

      d.grab =
        e.clientY - y.get();

      if (cardRef.current) {
        cardRef.current.dataset.swiping =
          '';
      }
    }

    const raw =
      e.clientY - d.grab;

    const next =
      raw >= 0
        ? raw
        : rubberband(
            raw,
            RESIST_PX
          );

    y.set(next);

    d.moved = true;

    d.hist.push([
      performance.now(),
      next
    ]);

    if (d.hist.length > 4) {
      d.hist.shift();
    }
  };

  const onPointerUp = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const d = drag.current;

    if (
      !d ||
      d.id !== e.pointerId
    ) {
      return;
    }

    drag.current = null;

    if (cardRef.current) {
      delete cardRef.current
        .dataset.swiping;
    }

    try {
      cardRef.current?.releasePointerCapture(
        e.pointerId
      );
    } catch {
      // Pointer capture is optional and may have been released by the browser.
    }

    flags.current.interacting =
      false;

    const dy = y.get();

    const velocity =
      velocityOf(d.hist);

    if (
      dy > 0 &&
      (
        velocity > FLICK ||
        (
          dy >= swipeDistance &&
          velocity >= 0
        )
      )
    ) {
      swipeOut(
        dy,
        velocity
      );
      return;
    }

    if (d.moved) {
      animate(
        y,
        0,
        reduce
          ? {
              duration: 0.2,
              ease: EASE_OUT
            }
          : {
              type: 'spring',
              duration: 0.5,
              bounce:
                settleBounce,
              velocity:
                velocity * 1000
            }
      );
    }

    const queued =
      pendingClose.current;

    pendingClose.current =
      null;

    if (queued) {
      close(queued);
    } else {
      syncFuse();
    }
  };

  return (
    <div
      className={`toast${
        className
          ? ` ${className}`
          : ''
      }`}
      data-phase={phase}
      data-inline={
        inline
          ? 'true'
          : 'false'
      }
      data-fuse={
        duration > 0
          ? fuse
          : 'none'
      }
      data-variant={variant}
      data-dismissible={
        dismissible
          ? 'true'
          : 'false'
      }
      data-instant={
        instant
          ? ''
          : undefined
      }
      data-mounted={
        mounted
          ? 'true'
          : 'false'
      }
      style={
        {
          '--toast-bg':
            resolvedBackground,
          '--toast-ink':
            resolvedColor,
          '--toast-fuse':
            resolvedFuseColor,
          '--toast-w':
            `${width}px`,
          '--toast-radius':
            `${radius}px`,
          '--toast-slide':
            `${slideMs}ms`,
          '--toast-gap':
            '10px'
        } as CSSProperties
      }
    >
      <div className="toast__gate">
        <div className="toast__lift">
          <motion.div
            ref={cardRef}
            className="toast__card"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            tabIndex={0}
            style={{
              transform,
              opacity: fade
            }}
            onPointerDown={
              onPointerDown
            }
            onPointerMove={
              onPointerMove
            }
            onPointerUp={
              onPointerUp
            }
            onPointerCancel={
              onPointerUp
            }
            onPointerEnter={e => {
              if (
                pauseOnHover &&
                e.pointerType ===
                  'mouse'
              ) {
                flags.current.hover =
                  true;

                syncFuse();
              }
            }}
            onPointerLeave={e => {
              if (
                e.pointerType ===
                'mouse'
              ) {
                flags.current.hover =
                  false;

                syncFuse();
              }
            }}
            onFocus={() => {
              flags.current.focus =
                true;

              syncFuse();
            }}
            onBlur={e => {
              if (
                !e.currentTarget.contains(
                  e.relatedTarget as
                    | Node
                    | null
                )
              ) {
                flags.current.focus =
                  false;

                syncFuse();
              }
            }}
            onKeyDown={e => {
              if (
                e.key === 'Enter' ||
                e.key === ' '
              ) {
                lastInput.current =
                  'keyboard';
              }

              if (
                e.key === 'Escape' &&
                dismissible
              ) {
                e.stopPropagation();
                close('escape');
              }
            }}
          >
            {icon ? (
              <span
                className="toast__icon"
                aria-hidden="true"
              >
                {icon}
              </span>
            ) : null}

            <span className="toast__body">
              <span className="toast__title">
                {title}
              </span>

              {description ? (
                <span className="toast__desc">
                  {description}
                </span>
              ) : null}
            </span>

            {actionLabel ? (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  latest.current.onAction?.();
                  close('action');
                }}
              >
                {actionLabel}
              </button>
            ) : null}

            {closeButton ? (
              <button
                type="button"
                className="toast__close"
                aria-label="Close"
                onClick={() =>
                  close('close')
                }
              >
                <X
                  size={18}
                  strokeWidth={2.5}
                />
              </button>
            ) : null}

            <i
              ref={fuseRef}
              className="toast__fuse"
              aria-hidden="true"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export { Toast };
export default Toast;