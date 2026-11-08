import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { ArrowLeft, Mic } from "lucide-react";
import "./VoicePill.css";

export type VoicePillStopReason =
  | "release"
  | "tap"
  | "key"
  | "escape"
  | "blur"
  | "disabled"
  | "mic-denied"
  | "cancel"
  | "unmount";

interface VoicePillProps {
  disabled?: boolean;
  onStart: (stream: MediaStream) => void;
  onStop: (info: { reason: VoicePillStopReason; duration: number }) => void | Promise<void>;
  onError: (error: unknown) => void;
}

interface VoiceState {
  listening: boolean;
  pointerId: number | null;
  ownPress: boolean;
  downX: number;
  sliding: boolean;
  history: number[];
  tick: number;
  accumulator: number;
  downAt: number;
  startedAt: number;
  frame: number;
  lastFrame: number;
  envelope: number;
  audio: {
    context: AudioContext;
    stream: MediaStream | null;
    source: MediaStreamAudioSourceNode | null;
    analyser: AnalyserNode | null;
    buffer: Uint8Array<ArrayBuffer> | null;
  } | null;
}

const MIC_BANDS = [[1, 4], [4, 11], [11, 33]];
const CANCEL_DISTANCE = 64;

const clock = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const drawWaveform = (
  state: VoiceState,
  canvas: HTMLCanvasElement,
  level: number,
) => {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) return;

  state.accumulator = Math.max(state.accumulator, level);
  state.tick = (state.tick + 1) % 4;
  if (state.tick === 0) {
    state.history.push(state.accumulator);
    state.accumulator = 0;
    if (state.history.length > 80) state.history.shift();
  }

  const barWidth = 2 * ratio;
  const step = 3 * ratio;
  const shift = (state.tick / 4) * step;
  context.clearRect(0, 0, width, height);
  context.fillStyle = getComputedStyle(canvas).getPropertyValue("--vp-wave").trim() || "#f5f5f5";
  for (let index = 0; index < state.history.length; index += 1) {
    const value = state.history[state.history.length - 1 - index];
    const x = width - (index + 1) * step - shift;
    if (x + barWidth < 0) break;
    const barHeight = Math.max(barWidth, (0.1 + 0.9 * value) * height);
    const fadeAmount = Math.min(1, Math.max(0, (x + barWidth / 2) / (width * 0.55)));
    const fade = fadeAmount * fadeAmount * (3 - 2 * fadeAmount);
    context.globalAlpha = (0.35 + 0.65 * value) * fade;
    context.beginPath();
    context.roundRect(x, (height - barHeight) / 2, barWidth, barHeight, barWidth / 2);
    context.fill();
  }
  context.globalAlpha = 1;
};

export const VoicePill = ({ disabled = false, onStart, onStop, onError }: VoicePillProps) => {
  const [listening, setListening] = useState(false);
  const [pressed, setPressed] = useState(false);
  const timeRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacksRef = useRef({ onStart, onStop, onError });
  const disabledRef = useRef(disabled);
  const stateRef = useRef<VoiceState>({
    listening: false,
    pointerId: null,
    ownPress: false,
    downX: 0,
    sliding: false,
    history: [],
    tick: 0,
    accumulator: 0,
    downAt: 0,
    startedAt: 0,
    frame: 0,
    lastFrame: 0,
    envelope: 0,
    audio: null,
  });

  useEffect(() => {
    callbacksRef.current = { onStart, onStop, onError };
    disabledRef.current = disabled;
  }, [disabled, onError, onStart, onStop]);

  const finish = (reason: VoicePillStopReason) => {
    const state = stateRef.current;
    if (!state.listening) return;
    state.listening = false;
    const duration = Math.round(performance.now() - state.startedAt);
    const audio = state.audio;
    audio?.stream?.getTracks().forEach(track => track.stop());
    audio?.source?.disconnect();
    state.audio = null;
    if (audio) void audio.context.close();
    setListening(false);
    void Promise.resolve(callbacksRef.current.onStop({ reason, duration }))
      .catch(callbacksRef.current.onError);
  };

  const start = async () => {
    const state = stateRef.current;
    if (state.listening || disabledRef.current) return;
    state.listening = true;
    state.history = [];
    state.tick = 0;
    state.accumulator = 0;
    state.envelope = 0;
    state.startedAt = performance.now();
    state.lastFrame = state.startedAt;
    setListening(true);
    if (timeRef.current) timeRef.current.textContent = "0:00";

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!state.listening) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const audioContext = new AudioContext();
      if (audioContext.state === "suspended") await audioContext.resume();
      if (!state.listening) {
        stream.getTracks().forEach(track => track.stop());
        await audioContext.close();
        return;
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      state.audio = {
        context: audioContext,
        stream,
        source,
        analyser,
        buffer: new Uint8Array(analyser.frequencyBinCount),
      };
      callbacksRef.current.onStart(stream);
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      callbacksRef.current.onError(error);
      finish("mic-denied");
      return;
    }

    const renderFrame = (now: number) => {
      const current = stateRef.current;
      if (!current.listening) return;
      const audio = current.audio;
      let level = 0;
      if (audio?.analyser && audio.buffer) {
        audio.analyser.getByteFrequencyData(audio.buffer);
        for (const [low, high] of MIC_BANDS) {
          let sum = 0;
          for (let index = low; index < high; index += 1) sum += audio.buffer[index];
          level += sum / ((high - low) * 255);
        }
        level = Math.min(1, (level / MIC_BANDS.length) * 2.2);
      }
      const delta = Math.min((now - current.lastFrame) / 1000, 0.05);
      current.lastFrame = now;
      const tau = (level > current.envelope ? 40 : 240) / 1000;
      current.envelope += (level - current.envelope) * (1 - Math.exp(-delta / tau));

      if (timeRef.current) {
        timeRef.current.textContent = clock(now - current.startedAt);
      }
      if (canvasRef.current) drawWaveform(current, canvasRef.current, current.envelope);
      current.frame = requestAnimationFrame(renderFrame);
    };
    state.frame = requestAnimationFrame(renderFrame);
  };

  const settleSlide = () => {
    const button = buttonRef.current;
    const state = stateRef.current;
    state.sliding = false;
    if (!button) return;
    delete button.dataset.sliding;
    button.style.setProperty("--vp-slide", "0px");
    button.style.setProperty("--vp-cancel", "0");
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const state = stateRef.current;
    if (disabled || event.button !== 0 || !event.isPrimary || state.pointerId !== null) return;
    state.pointerId = event.pointerId;
    state.downX = event.clientX;
    state.downAt = performance.now();
    state.ownPress = !state.listening;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be unavailable in some embedded browsers.
    }
    setPressed(true);
    if (!state.listening) void start();
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = stateRef.current;
    const button = buttonRef.current;
    if (!button || state.pointerId !== event.pointerId || !state.listening || !state.ownPress) return;
    const delta = event.clientX - state.downX;
    if (!state.sliding && delta > -4) return;
    state.sliding = true;
    button.dataset.sliding = "";
    const pull = Math.min(CANCEL_DISTANCE + 24, Math.max(0, -delta));
    button.style.setProperty("--vp-slide", `${-pull}px`);
    const progress = Math.min(1, pull / CANCEL_DISTANCE);
    button.style.setProperty("--vp-cancel", progress.toFixed(3));
    if (progress >= 1) {
      settleSlide();
      finish("cancel");
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const state = stateRef.current;
    if (event.pointerId !== state.pointerId) return;
    state.pointerId = null;
    setPressed(false);
    if (state.sliding) settleSlide();
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may already have been released by the browser.
    }
    if (!state.listening) return;

    const heldFor = performance.now() - state.downAt;
    if (state.ownPress) {
      if (heldFor >= 300) finish("release");
    } else {
      finish(heldFor < 300 ? "tap" : "release");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      finish("escape");
    } else if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      if (stateRef.current.listening) finish("key");
      else void start();
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0 && stateRef.current.pointerId === null) {
      if (stateRef.current.listening) finish("key");
      else void start();
    }
  };

  useEffect(() => {
    if (!pressed) return;
    const stopOnBlur = () => {
      stateRef.current.pointerId = null;
      stateRef.current.ownPress = false;
      setPressed(false);
      settleSlide();
      finish("blur");
    };
    const stopWhenHidden = () => {
      if (document.hidden) stopOnBlur();
    };
    window.addEventListener("blur", stopOnBlur);
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      window.removeEventListener("blur", stopOnBlur);
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, [pressed]);

  useEffect(() => {
    if (disabled) finish("disabled");
  }, [disabled]);

  useEffect(() => () => {
    const state = stateRef.current;
    if (state.listening) finish("unmount");
    cancelAnimationFrame(state.frame);
    void state.audio?.context.close();
  }, []);

  const styles = {
    "--vp-size": "36px",
    "--vp-radius": "18px",
    "--vp-reach": "8px",
    "--vp-extra": "104px",
    "--vp-clock-w": "36px",
    "--vp-wave-w": "68px",
    "--vp-stop": "12px",
    "--vp-time-size": "13px",
    "--vp-open": "200ms",
    "--vp-press": 0.95,
    "--vp-hit": "8px",
  } as CSSProperties;

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      aria-label={listening ? "Stop voice recording" : "Record a voice message"}
      aria-pressed={listening}
      className="voice-pill"
      data-state={listening ? "listening" : "idle"}
      data-pressed={pressed ? "" : undefined}
      data-time=""
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onContextMenu={event => event.preventDefault()}
      style={styles}
    >
      <span className="voice-pill__capsule" aria-hidden="true" />
      <canvas ref={canvasRef} className="voice-pill__wave" aria-hidden="true" />
      <span className="voice-pill__cancel" aria-hidden="true">
        <ArrowLeft size={12} strokeWidth={2.2} />
        <span>Cancel</span>
      </span>
      <span ref={timeRef} className="voice-pill__time" aria-hidden="true">0:00</span>
      <span className="voice-pill__glyph">
        <span className="voice-pill__mic"><Mic size={15} strokeWidth={2} /></span>
        <span className="voice-pill__stop" aria-hidden="true" />
      </span>
    </button>
  );
};
