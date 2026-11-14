import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  Check,
  ChevronDown,
  Globe2,
  LoaderCircle,
  Mic,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import "./AiPromptBar.css";

export const AI_MODELS = [
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "Fast, efficient for everyday questions",
    supportsSearch: true,
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen 3.8",
    description: "Balanced model for general tasks",
    supportsSearch: false,
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    description: "Deeper reasoning for complex tasks",
    supportsSearch: true,
  },
] as const;

export const AI_EFFORTS = ["low", "balanced", "high"] as const;
export const AI_PROMPT_MAX_CHARS = 2_000;

export type AiModelId = (typeof AI_MODELS)[number]["id"];
export type AiEffort = (typeof AI_EFFORTS)[number];

export interface AiPromptOptions {
  model: AiModelId;
  effort: AiEffort;
  webSearch: boolean;
}

interface AiPromptBarProps {
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  initialModel?: AiModelId;
  initialEffort?: AiEffort;
  initialWebSearch?: boolean;
  onSend: (text: string, options: AiPromptOptions) => void;
  onStop: () => void;
  onDictate?: () => Promise<string | void>;
}

type Suggestion = { key: string; name: string; description: string };
type Token = { kind: "mention" | "command"; query: string; start: number };
type Spark = { x: number; y: number; radius: number; phase: number; life: number; duration: number };

const COMMANDS: Suggestion[] = [
  { key: "summarize", name: "/summarize", description: "Summarize this conversation" },
  { key: "explain", name: "/explain", description: "Explain the next answer clearly" },
  { key: "draft", name: "/draft", description: "Draft a first version" },
  { key: "compare", name: "/compare", description: "Compare options side by side" },
  { key: "tasks", name: "/tasks", description: "Turn this into a task list" },
];

const SOURCES: Suggestion[] = [
  { key: "web", name: "@Web search", description: "Search the web for current information" },
];

const ARROW_PATH = [12, 4.5, 18.5, 11, 14.25, 11, 14.25, 19.5, 9.75, 19.5, 9.75, 11, 5.5, 11];
const STOP_PATH = [12, 6, 18, 6, 18, 12, 18, 18, 6, 18, 6, 12, 6, 6];
const EASE: [number, number, number, number] = [0.77, 0, 0.175, 1];
const STEP_EDGE = 11;

function readToken(text: string): Token | null {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(text);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "mention" : "command",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

function pathAt(from: number[], to: number[], amount: number): string {
  let path = "";
  for (let index = 0; index < from.length; index += 2) {
    const x = from[index] + (to[index] - from[index]) * amount;
    const y = from[index + 1] + (to[index + 1] - from[index + 1]) * amount;
    path += `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${path}Z`;
}

function SendGlyph({ busy, pressed }: { busy: boolean; pressed: boolean }) {
  const reduceMotion = useReducedMotion();
  const progress = useMotionValue(busy ? 1 : 0);
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const direction = useRef(busy ? 1 : -1);

  useEffect(() => {
    const target = busy ? 1 : 0;
    direction.current = busy ? 1 : -1;
    const controls = animate(progress, target, reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE });
    return () => controls.stop();
  }, [busy, progress, reduceMotion]);

  useMotionValueEvent(progress, "change", (value) => {
    pathRef.current?.setAttribute("d", pathAt(ARROW_PATH, STOP_PATH, value));
    const bend = reduceMotion ? 0 : Math.sin(value * Math.PI);
    if (svgRef.current) {
      svgRef.current.style.transform = bend
        ? `rotate(${direction.current * 8 * bend}deg) scale(${1 - 0.12 * bend}, ${1 + 0.12 * bend})`
        : "";
    }
  });

  return (
    <svg
      ref={svgRef}
      className={`ai-prompt-bar__glyph${pressed ? " ai-prompt-bar__glyph--pressed" : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path ref={pathRef} d={pathAt(ARROW_PATH, STOP_PATH, busy ? 1 : 0)} />
    </svg>
  );
}

export function AiPromptBar({
  busy = false,
  disabled = false,
  placeholder = "Message Kepler AI...",
  initialModel = AI_MODELS[0].id,
  initialEffort = "balanced",
  initialWebSearch = false,
  onSend,
  onStop,
  onDictate,
}: AiPromptBarProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const typing = useRef({ energy: 0, strokes: 0 });
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastMenu = useRef<string | null>(null);

  const [draft, setDraft] = useState("");
  const [model, setModel] = useState<AiModelId>(initialModel);
  const [effort, setEffort] = useState<AiEffort>(initialEffort);
  const [webSearch, setWebSearch] = useState(
    initialWebSearch && AI_MODELS.find((item) => item.id === initialModel)?.supportsSearch === true
  );
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [pressed, setPressed] = useState(false);

  const selectedModel = AI_MODELS.find((item) => item.id === model) ?? AI_MODELS[0];
  const searchEnabled = selectedModel.supportsSearch && webSearch;
  const token = dismissed ? null : readToken(draft);
  const open = plusOpen ? "source" : (token?.kind ?? (modelOpen ? "model" : effortOpen ? "effort" : null));
  const query = plusOpen ? "" : (token?.query ?? "");
  const rows: Suggestion[] =
    open === "source" || open === "mention"
      ? SOURCES.filter((source) => selectedModel.supportsSearch && source.name.toLowerCase().includes(query))
      : open === "command"
        ? COMMANDS.filter((command) => command.name.slice(1).startsWith(query))
        : open === "model"
          ? AI_MODELS.map((item) => ({
              key: item.id,
              name: item.label,
              description: item.description,
            }))
          : [];
  const cursor = Math.min(active, Math.max(0, rows.length - 1));
  const canSend = draft.trim().length > 0;
  const armed = busy || (canSend && !disabled);
  const effortIndex = AI_EFFORTS.indexOf(effort);
  const maxEffort = effort === "high";

  const focusInput = useCallback(() => inputRef.current?.focus({ preventScroll: true }), []);
  const closeMenus = useCallback(() => {
    setPlusOpen(false);
    setModelOpen(false);
    setEffortOpen(false);
  }, [setPlusOpen, setModelOpen, setEffortOpen]);

  useLayoutEffect(() => {
    const glow = glowRef.current;
    if (!glow || !open || open === "effort") return;
    const row = rowRefs.current[cursor];
    if (!row) {
      glow.style.opacity = "0";
      return;
    }
    const fresh = lastMenu.current !== open;
    lastMenu.current = open;
    if (fresh) glow.style.transition = "none";
    glow.style.top = `${row.offsetTop}px`;
    glow.style.height = `${row.offsetHeight}px`;
    glow.style.opacity = "1";
    if (fresh) {
      void glow.offsetHeight;
      glow.style.transition = "";
    }
  }, [open, query, cursor]);

  useEffect(() => {
    if (!open) lastMenu.current = null;
  }, [open]);

  useEffect(() => {
    if (!plusOpen && !modelOpen && !effortOpen) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [plusOpen, modelOpen, effortOpen, closeMenus]);

  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "0px";
    const maxHeight = 22 * 5;
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    const canvas = sparkRef.current;
    if (!maxEffort || reduceMotion || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    typing.current.strokes = 0;
    let frame = 0;
    let previous = performance.now();
    let width = 0;
    let height = 0;
    let due = 0;
    let speed = 1;
    let pulse = 0;
    let resizePending = false;
    const particles: Spark[] = [];
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    const spawn = (burst: boolean) => {
      particles.push({
        x: Math.random() * width,
        y: burst ? height * (0.2 + Math.random() * 0.8) : height + 3,
        radius: 0.9 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        life: burst ? Math.random() * 1.2 : 0,
        duration: 2.4 + Math.random() * 2.4,
      });
    };
    const tick = (now: number) => {
      if (resizePending) {
        resizePending = false;
        resize();
      }
      const delta = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      typing.current.energy *= Math.exp(-delta / 0.8);
      pulse *= Math.exp(-delta / 0.16);
      if (typing.current.strokes) {
        typing.current.strokes = 0;
        pulse = 1;
      }
      const energy = typing.current.energy;
      speed += (1 + energy * 6 - speed) * (1 - Math.exp(-delta / 0.15));
      due += delta;
      while (due > 0.14) {
        due -= 0.14;
        if (particles.length < 30) spawn(false);
      }

      const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      const sparkColor = `hsl(${primary})`;
      context.clearRect(0, 0, width, height);
      context.fillStyle = sparkColor;
      context.shadowColor = sparkColor;
      context.shadowBlur = 6 + energy * 10 + pulse * 6;

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.life += delta;
        if (particle.life > particle.duration) {
          particles.splice(index, 1);
          continue;
        }
        const progress = particle.life / particle.duration;
        const twinkle = 0.7 + 0.3 * Math.sin(now / 160 + particle.phase);
        particle.y -= (7 + particle.radius * 5) * delta * speed;
        if (particle.y < -4) {
          particle.y = height + 3;
          particle.x = Math.random() * width;
        }
        const edge = Math.min(1, Math.max(0, particle.y / 14), Math.max(0, (height - particle.y) / 14));
        context.globalAlpha = Math.min(1, Math.sin(progress * Math.PI) * twinkle) * edge;
        context.beginPath();
        context.arc(
          particle.x + Math.sin(now / 900 + particle.phase) * 5,
          particle.y,
          particle.radius * twinkle,
          0,
          Math.PI * 2
        );
        context.fill();
      }
      frame = requestAnimationFrame(tick);
    };

    resize();
    for (let index = 0; index < 24; index += 1) spawn(true);
    const observer = new ResizeObserver(() => {
      resizePending = true;
    });
    observer.observe(canvas);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      context.clearRect(0, 0, width, height);
    };
  }, [maxEffort, reduceMotion]);

  const changeEffort = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(AI_EFFORTS.length - 1, index));
    setEffort(AI_EFFORTS[clampedIndex]);
  };
  const effortFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left - STEP_EDGE) / Math.max(1, rect.width - STEP_EDGE * 2);
    changeEffort(Math.round(fraction * (AI_EFFORTS.length - 1)));
  };
  const effortStepAt = (index: number) =>
    `calc(${STEP_EDGE}px + (100% - ${STEP_EDGE * 2}px) * ${index / (AI_EFFORTS.length - 1)})`;
  const effortFillAt = (index: number) =>
    index === AI_EFFORTS.length - 1 ? "100%" : `calc(${effortStepAt(index)} + 7px)`;

  const pick = (row: Suggestion) => {
    if (open === "model") {
      const next = AI_MODELS.find((item) => item.id === row.key);
      if (next) {
        setModel(next.id);
        if (!next.supportsSearch) setWebSearch(false);
      }
      setModelOpen(false);
      focusInput();
      return;
    }

    if (row.key === "web") {
      if (!selectedModel.supportsSearch) return;
      setWebSearch((enabled) => !enabled);
      setDraft(token ? draft.slice(0, token.start).trimEnd() : draft);
    } else {
      const head = token ? draft.slice(0, token.start) : draft;
      setDraft(`${head}${row.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    focusInput();
  };

  const send = () => {
    const text = draft.trim();
    if (!text || busy || disabled) return;
    onSend(text, { model, effort, webSearch: searchEnabled });
    setDraft("");
    setDismissed(false);
    closeMenus();
    focusInput();
  };

  const toggleListening = async () => {
    if (!onDictate || disabled || busy) return;
    if (listening) {
      setListening(false);
      await onDictate();
      return;
    }
    setListening(true);
    try {
      const text = await onDictate();
      if (text) {
        setDraft((current) =>
          `${current.trimEnd()}${current.trim() ? " " : ""}${text}`.slice(0, AI_PROMPT_MAX_CHARS)
        );
      }
    } finally {
      setListening(false);
    }
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && rows.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActive((cursor + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
        return;
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault();
        pick(rows[cursor]);
        return;
      }
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setDismissed(true);
      closeMenus();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const listForOpenMenu = open === "effort" ? [] : rows;
  const effortStyle = {
    "--pb-effort-x": effortStepAt(effortIndex),
    "--pb-effort-fill": effortFillAt(effortIndex),
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className="ai-prompt-bar"
      data-busy={busy ? "" : undefined}
      data-max={maxEffort ? "" : undefined}
    >
      {open && (
        <div
          className="ai-prompt-bar__menu"
          role={open === "effort" ? "dialog" : "listbox"}
          aria-label={open === "effort" ? "Reasoning effort" : open === "model" ? "AI models" : "Suggestions"}
          data-kind={open}
        >
          {open === "effort" ? (
            <>
              <div className="ai-prompt-bar__effort-head">
                <span className="ai-prompt-bar__effort-title">Reasoning effort</span>
                <span className="ai-prompt-bar__effort-level">{effort}</span>
                <span className="ai-prompt-bar__effort-help" title="Higher effort thinks longer before answering">
                  <Sparkles size={14} aria-hidden="true" />
                </span>
              </div>
              <p className="ai-prompt-bar__effort-description">
                {effort === "low"
                  ? "Faster and uses fewer tokens, but may be less capable."
                  : effort === "balanced"
                    ? "Balances token use and reasoning."
                    : "Maximum effort for smarter answers; uses more tokens."}
              </p>
              <div className="ai-prompt-bar__effort-ends">
                <span>Faster</span>
                <span>More reasoning</span>
              </div>
              <div
                className="ai-prompt-bar__effort-track"
                role="slider"
                tabIndex={0}
                aria-label="Reasoning effort"
                aria-valuemin={0}
                aria-valuemax={AI_EFFORTS.length - 1}
                aria-valuenow={effortIndex}
                aria-valuetext={effort}
                style={effortStyle}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  event.currentTarget.focus({ preventScroll: true });
                  effortFromPointer(event);
                }}
                onPointerMove={(event) => {
                  if (event.buttons & 1) effortFromPointer(event);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                    event.preventDefault();
                    changeEffort(effortIndex + 1);
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                    event.preventDefault();
                    changeEffort(effortIndex - 1);
                  } else if (event.key === "Home") {
                    changeEffort(0);
                  } else if (event.key === "End") {
                    changeEffort(AI_EFFORTS.length - 1);
                  } else if (event.key === "Escape") {
                    setEffortOpen(false);
                    focusInput();
                  }
                }}
              >
                <span className="ai-prompt-bar__effort-fill" />
                {AI_EFFORTS.map((item, index) => (
                  <i key={item} className="ai-prompt-bar__effort-dot" style={{ left: effortStepAt(index) }} />
                ))}
                <span className="ai-prompt-bar__effort-thumb" />
              </div>
              <div className="ai-prompt-bar__effort-labels">
                {AI_EFFORTS.map((item) => <span key={item}>{item}</span>)}
              </div>
            </>
          ) : (
            <>
              <span ref={glowRef} className="ai-prompt-bar__glow" aria-hidden="true" />
              {listForOpenMenu.map((row, index) => {
                return (
                  <button
                    key={row.key}
                    ref={(element) => { rowRefs.current[index] = element; }}
                    type="button"
                    role="option"
                    aria-selected={index === cursor}
                    className={`ai-prompt-bar__row${open === "model" ? " ai-prompt-bar__row--model" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => pick(row)}
                  >
                    {open !== "command" && open !== "model" && (
                      <span className="ai-prompt-bar__row-icon"><Globe2 size={15} /></span>
                    )}
                    {open === "model" ? (
                      <span className="ai-prompt-bar__row-copy">
                        <span className="ai-prompt-bar__row-name">{row.name}</span>
                        <span className="ai-prompt-bar__row-desc">{row.description}</span>
                      </span>
                    ) : (
                      <>
                        <span className="ai-prompt-bar__row-name">{row.name}</span>
                        <span className="ai-prompt-bar__row-desc">{row.description}</span>
                      </>
                    )}
                    {open === "model" && (
                      <span className="ai-prompt-bar__row-check" data-on={row.key === model ? "" : undefined}>
                        <Check size={13} strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                );
              })}
              {listForOpenMenu.length === 0 && (
                <div className="ai-prompt-bar__empty">No matches for “{query}”</div>
              )}
            </>
          )}
        </div>
      )}

      <div
        className="ai-prompt-bar__field"
        data-max={maxEffort ? "" : undefined}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget || event.target === inputRef.current) closeMenus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) focusInput();
        }}
      >
        <canvas ref={sparkRef} className="ai-prompt-bar__sparks" aria-hidden="true" />
        {searchEnabled && (
          <div className="ai-prompt-bar__search-status">
            <span className="ai-prompt-bar__search-chip">
              <Globe2 size={13} strokeWidth={2} />
              <span>Search the web</span>
              <button
                type="button"
                className="ai-prompt-bar__search-remove"
                aria-label="Turn off web search"
                disabled={busy || disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setWebSearch(false)}
              >
                <X size={13} strokeWidth={2.2} />
              </button>
            </span>
          </div>
        )}
        <textarea
          ref={inputRef}
          className="ai-prompt-bar__textarea"
          rows={1}
          value={draft}
          maxLength={AI_PROMPT_MAX_CHARS}
          placeholder={disabled ? "AI usage limit reached" : listening ? "Listening..." : placeholder}
          aria-label="Message Kepler AI"
          disabled={disabled || busy || listening}
          onChange={(event) => {
            setDraft(event.target.value.slice(0, AI_PROMPT_MAX_CHARS));
            typing.current.energy = Math.min(1.6, typing.current.energy + 0.22);
            typing.current.strokes = Math.min(4, typing.current.strokes + 1);
            setDismissed(false);
            closeMenus();
            setActive(0);
          }}
          onFocus={closeMenus}
          onKeyDown={onInputKeyDown}
        />

        <div className="ai-prompt-bar__toolbar">
          <button
            type="button"
            className="ai-prompt-bar__tool"
            aria-label={selectedModel.supportsSearch ? "Show sources" : "Web search unavailable for this model"}
            aria-expanded={plusOpen}
            data-on={plusOpen ? "" : undefined}
            disabled={busy || disabled || !selectedModel.supportsSearch}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setModelOpen(false);
              setEffortOpen(false);
              setActive(0);
              setPlusOpen((value) => !value);
              focusInput();
            }}
          >
            <Plus size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="ai-prompt-bar__pick"
            aria-label="Choose model"
            aria-expanded={modelOpen}
            data-on={modelOpen ? "" : undefined}
            disabled={busy || disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setPlusOpen(false);
              setEffortOpen(false);
              setActive(Math.max(0, AI_MODELS.findIndex((item) => item.id === model)));
              setModelOpen((value) => !value);
              focusInput();
            }}
          >
            <span>{selectedModel.label}</span>
            <ChevronDown className="ai-prompt-bar__caret" size={12} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className="ai-prompt-bar__pick"
            aria-label="Choose reasoning effort"
            aria-expanded={effortOpen}
            data-on={effortOpen ? "" : undefined}
            data-max={maxEffort ? "" : undefined}
            disabled={busy || disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setPlusOpen(false);
              setModelOpen(false);
              setEffortOpen((value) => !value);
              focusInput();
            }}
          >
            <Sparkles size={13} strokeWidth={2} />
            <span>{effort}</span>
            <ChevronDown className="ai-prompt-bar__caret" size={12} strokeWidth={2.4} />
          </button>
          <span className="ai-prompt-bar__spacer" />
          <span className="ai-prompt-bar__counter">{draft.length}/{AI_PROMPT_MAX_CHARS.toLocaleString()}</span>
          {onDictate && (
            <button
              type="button"
              className="ai-prompt-bar__tool"
              aria-label={listening ? "Stop dictation" : "Dictate"}
              aria-pressed={listening}
              data-on={listening ? "" : undefined}
              disabled={busy || disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void toggleListening()}
            >
              {listening
                ? <span className="ai-prompt-bar__eq"><i /><i /><i /></span>
                : <Mic size={15} strokeWidth={2} />}
            </button>
          )}
          <button
            type="button"
            className="ai-prompt-bar__send"
            aria-label={busy ? "Stop generating" : "Send message"}
            data-armed={armed ? "" : undefined}
            disabled={!armed}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              if (event.button === 0 && armed) setPressed(true);
            }}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            onClick={() => {
              if (busy) onStop();
              else send();
            }}
          >
            <SendGlyph busy={busy} pressed={pressed} />
          </button>
        </div>
      </div>
    </div>
  );
}
