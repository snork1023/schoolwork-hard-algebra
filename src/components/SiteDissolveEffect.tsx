import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import "./SiteDissolveEffect.css";

const AFTERIMAGE_LINES = [
  "You found the edge of the universe.",
  "The veil remembers your touch.",
  "The stars remember your name.",
  "Some doors only open once.",
  "Beyond this point, everything is new.",
];

const CONSTELLATION_TARGETS = [
  { x: 205, y: 160 },
  { x: 295, y: 160 },
  { x: 295, y: 250 },
  { x: 205, y: 250 },
  { x: 360, y: 125 },
  { x: 325, y: 190 },
  { x: 430, y: 160 },
  { x: 350, y: 285 },
  { x: 410, y: 265 },
];
const CONSTELLATION_STAR_COUNT = CONSTELLATION_TARGETS.length;
const CONSTELLATION_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [1, 4],
  [1, 5],
  [5, 6],
  [2, 7],
  [7, 8],
] as const;

const CONSTELLATION_STARTS = Array.from({ length: CONSTELLATION_STAR_COUNT }, (_, index) => ({
  x: 50 + ((index * 173 + 41) % 500),
  y: 28 + ((index * 97 + 63) % 360),
}));

const SNAP_DISTANCE = 25;
const STAR_PICKUP_DISTANCE = 17;
const CONSTELLATION_SOLVED_KEY = "kepler-constellation-solved";

type PuzzleStar = { x: number; y: number; targetIndex: number | null };
type DissolvePhase = "hidden" | "blackout" | "story" | "constellation" | "returning";
type PuzzleStage = "placing" | "connecting";

const getConnectionKey = (from: number, to: number) => `${Math.min(from, to)}-${Math.max(from, to)}`;

const SiteDissolveEffect = () => {
  const [phase, setPhase] = useState<DissolvePhase>("hidden");
  const [storyIndex, setStoryIndex] = useState(0);
  const [stars, setStars] = useState<PuzzleStar[]>(() =>
    CONSTELLATION_STARTS.map((position) => ({ ...position, targetIndex: null })),
  );
  const [puzzleStage, setPuzzleStage] = useState<PuzzleStage>("placing");
  const [draggingStar, setDraggingStar] = useState<number | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<number | null>(null);
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
  const [connectedLines, setConnectedLines] = useState<Set<string>>(() => new Set());
  const starsRef = useRef(stars);
  const connectedLinesRef = useRef(new Set<string>());
  const draggingStarRef = useRef<number | null>(null);
  const connectingFromRef = useRef<number | null>(null);
  const hasSolvedRef = useRef(false);

  useEffect(() => {
    const startDissolve = () => setPhase("blackout");
    window.addEventListener("kepler-site-dissolve", startDissolve);
    return () => window.removeEventListener("kepler-site-dissolve", startDissolve);
  }, []);

  useEffect(() => {
    if (phase === "hidden") return;
    const root = document.getElementById("root");
    if (phase === "returning") {
      root?.classList.remove("site-dissolving");
      root?.classList.add("site-returning");
    } else {
      root?.classList.remove("site-returning");
      root?.classList.add("site-dissolving");
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "story") return;
    const timer = window.setTimeout(() => {
      if (storyIndex === AFTERIMAGE_LINES.length - 1) {
        setPhase("constellation");
      } else {
        setStoryIndex((index) => index + 1);
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [phase, storyIndex]);

  useEffect(() => {
    if (phase !== "returning") return;
    const timer = window.setTimeout(() => {
      document.getElementById("root")?.classList.remove("site-returning");
      setPhase("hidden");
    }, 1900);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "hidden") return null;

  const getMapPosition = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 600,
      y: ((event.clientY - bounds.top) / bounds.height) * 420,
    };
  };

  const solveConstellation = () => {
    if (hasSolvedRef.current) return;
    hasSolvedRef.current = true;
    window.localStorage.setItem(CONSTELLATION_SOLVED_KEY, "true");
    window.dispatchEvent(new Event("kepler-constellation-solved"));
    window.setTimeout(() => setPhase("returning"), 750);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const position = getMapPosition(event);
    setPointerPosition(position);

    if (puzzleStage === "placing" && draggingStarRef.current !== null) {
      const starIndex = draggingStarRef.current;
      const next = [...starsRef.current];
      const occupiedTargets = new Set(
        next.flatMap((star, index) =>
          index !== starIndex && star.targetIndex !== null ? [star.targetIndex] : [],
        ),
      );
      const snappedTargetIndex = CONSTELLATION_TARGETS.findIndex(
        (target, index) =>
          !occupiedTargets.has(index) &&
          Math.hypot(position.x - target.x, position.y - target.y) <= SNAP_DISTANCE,
      );
      const target = CONSTELLATION_TARGETS[snappedTargetIndex];
      next[starIndex] =
        snappedTargetIndex === -1
          ? { ...position, targetIndex: null }
          : { ...target, targetIndex: snappedTargetIndex };
      starsRef.current = next;
      setStars(next);
      return;
    }

    if (puzzleStage === "connecting" && connectingFromRef.current !== null) {
      setPointerPosition(position);
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (puzzleStage === "placing") {
      draggingStarRef.current = null;
      setDraggingStar(null);
      if (starsRef.current.every((star) => star.targetIndex !== null)) {
        setPuzzleStage("connecting");
      }
      return;
    }

    if (connectingFromRef.current === null || event.pointerType !== "mouse") return;
    const from = connectingFromRef.current;
    const position = getMapPosition(event);
    const destination = starsRef.current.find(
      (star) =>
        star.targetIndex !== null &&
        Math.hypot(position.x - star.x, position.y - star.y) <= STAR_PICKUP_DISTANCE,
    );
    const to = destination?.targetIndex ?? -1;
    const edgeExists = CONSTELLATION_CONNECTIONS.some(
      ([a, b]) => (a === from && b === to) || (a === to && b === from),
    );

    if (to !== -1 && to !== from && edgeExists) {
      const next = new Set(connectedLinesRef.current);
      next.add(getConnectionKey(from, to));
      connectedLinesRef.current = next;
      setConnectedLines(next);
      if (next.size === CONSTELLATION_CONNECTIONS.length) solveConstellation();
    }

    connectingFromRef.current = null;
    setConnectingFrom(null);
  };

  const handleStarPointerDown = (event: PointerEvent<SVGGElement>, starIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    if (puzzleStage === "placing") {
      draggingStarRef.current = starIndex;
      setDraggingStar(starIndex);
      return;
    }

    if (event.pointerType !== "mouse") return;
    const targetIndex = starsRef.current[starIndex].targetIndex;
    if (targetIndex === null) return;
    connectingFromRef.current = targetIndex;
    setConnectingFrom(targetIndex);
  };

  const handleStarKeyDown = (event: React.KeyboardEvent<SVGGElement>, starIndex: number) => {
    if (puzzleStage !== "placing" || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    const next = [...starsRef.current];
    const occupied = new Set(next.flatMap((star) => star.targetIndex === null ? [] : [star.targetIndex]));
    const targetIndex = CONSTELLATION_TARGETS.findIndex((_, index) => !occupied.has(index));
    if (targetIndex === -1) return;
    const target = CONSTELLATION_TARGETS[targetIndex];
    next[starIndex] = { ...target, targetIndex };
    starsRef.current = next;
    setStars(next);
    if (next.every((star) => star.targetIndex !== null)) setPuzzleStage("connecting");
  };

  const alignedTargets = stars.flatMap((star) =>
    star.targetIndex === null ? [] : [star.targetIndex],
  );

  return createPortal(
    <div className="site-dissolve-stage">
      {(phase === "blackout" || phase === "story" || phase === "constellation" || phase === "returning") && (
        <div
          className={`site-dissolve-overlay ${phase === "returning" ? "site-dissolve-overlay--returning" : ""}`}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget && phase === "blackout") {
              setPhase("story");
            }
          }}
        />
      )}
      {phase === "story" && (
        <div className="site-afterimage" aria-live="polite" aria-atomic="true">
          <p key={storyIndex} className="site-afterimage__line">
            {AFTERIMAGE_LINES[storyIndex]}
          </p>
        </div>
      )}
      {phase === "constellation" && (
        <section className="constellation-scene" aria-label="Constellation puzzle">
          <svg
            className={`constellation-map ${puzzleStage === "connecting" ? "is-connecting" : ""}`}
            viewBox="0 0 600 420"
            preserveAspectRatio="none"
            role="group"
            aria-label="Constellation puzzle"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              <radialGradient id="constellation-star-glow">
                <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
                <stop offset="0.24" stopColor="#c4b5fd" stopOpacity="0.6" />
                <stop offset="1" stopColor="#818cf8" stopOpacity="0" />
              </radialGradient>
            </defs>
            {CONSTELLATION_CONNECTIONS.map(([from, to]) => {
              const fromPosition = CONSTELLATION_TARGETS[from];
              const toPosition = CONSTELLATION_TARGETS[to];
              const isConnected = connectedLines.has(getConnectionKey(from, to));
              return (
                <line
                  key={`line-${from}-${to}`}
                  x1={fromPosition.x}
                  y1={fromPosition.y}
                  x2={toPosition.x}
                  y2={toPosition.y}
                  className={`constellation-map__line ${
                    alignedTargets.includes(from) && alignedTargets.includes(to) ? "is-available" : ""
                  } ${isConnected ? "is-lit" : ""}`}
                />
              );
            })}
            {connectingFrom !== null && (
              <line
                x1={CONSTELLATION_TARGETS[connectingFrom].x}
                y1={CONSTELLATION_TARGETS[connectingFrom].y}
                x2={pointerPosition.x}
                y2={pointerPosition.y}
                className="constellation-map__line constellation-map__line--preview"
              />
            )}
            {stars.map((star, index) => (
              <g
                key={`star-${index}`}
                className={`constellation-map__star ${
                  draggingStar === index ? "is-dragging" : ""
                } ${star.targetIndex !== null ? "is-aligned" : ""}`}
                onPointerDown={(event) => handleStarPointerDown(event, index)}
                onKeyDown={(event) => handleStarKeyDown(event, index)}
                role="button"
                tabIndex={0}
                aria-label={`Star ${index + 1}${star.targetIndex !== null ? ", placed" : ", unplaced"}`}
                transform={`translate(${star.x} ${star.y})`}
              >
                <circle r="25" className="constellation-map__star-hitarea" />
                <circle r="6" className="constellation-map__star-halo" />
                <circle r="1.7" className="constellation-map__star-point" />
                <circle r="0.55" className="constellation-map__star-core" />
              </g>
            ))}
          </svg>
        </section>
      )}
    </div>,
    document.body,
  );
};

export default SiteDissolveEffect;
