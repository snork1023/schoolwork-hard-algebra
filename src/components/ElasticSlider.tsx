import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import './ElasticSlider.css';

const MAX_OVERFLOW = 50;

interface ElasticSliderProps {
  defaultValue?: number;
  startingValue?: number;
  maxValue?: number;
  className?: string;
  isStepped?: boolean;
  stepSize?: number;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onChange?: (value: number) => void;
  formatValue?: (value: number) => string;
}

export default function ElasticSlider({
  defaultValue = 50,
  startingValue = 0,
  maxValue = 100,
  className = '',
  isStepped = false,
  stepSize = 1,
  leftIcon = <span>-</span>,
  rightIcon = <span>+</span>,
  onChange,
  formatValue,
}: ElasticSliderProps) {
  return (
    <div className={`slider-container ${className}`}>
      <Slider
        defaultValue={defaultValue}
        startingValue={startingValue}
        maxValue={maxValue}
        isStepped={isStepped}
        stepSize={stepSize}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        onChange={onChange}
        formatValue={formatValue}
      />
    </div>
  );
}

interface SliderProps {
  defaultValue: number;
  startingValue: number;
  maxValue: number;
  isStepped: boolean;
  stepSize: number;
  leftIcon: ReactNode;
  rightIcon: ReactNode;
  onChange?: (value: number) => void;
  formatValue?: (value: number) => string;
}

function Slider({
  defaultValue,
  startingValue,
  maxValue,
  isStepped,
  stepSize,
  leftIcon,
  rightIcon,
  onChange,
  formatValue,
}: SliderProps) {
  const [value, setValue] = useState(defaultValue);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState<'left' | 'middle' | 'right'>('middle');
  const clientX = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale = useMotionValue(1);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useMotionValueEvent(clientX, 'change', (latest) => {
    if (sliderRef.current) {
      const { left, right } = sliderRef.current.getBoundingClientRect();
      let newValue: number;

      if (latest < left) {
        setRegion('left');
        newValue = left - latest;
      } else if (latest > right) {
        setRegion('right');
        newValue = latest - right;
      } else {
        setRegion('middle');
        newValue = 0;
      }

      overflow.jump(decay(newValue, MAX_OVERFLOW));
    }
  });

  const commitValue = (newValue: number) => {
    const clamped = Math.min(Math.max(newValue, startingValue), maxValue);
    setValue(clamped);
    onChange?.(clamped);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons > 0 && sliderRef.current) {
      const { left, width } = sliderRef.current.getBoundingClientRect();
      let newValue = startingValue + ((e.clientX - left) / width) * (maxValue - startingValue);

      if (isStepped) {
        newValue = Math.round(newValue / stepSize) * stepSize;
      }

      commitValue(newValue);
      clientX.jump(e.clientX);
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    handlePointerMove(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = () => {
    animate(overflow, 0, { type: 'spring', bounce: 0.5 });
  };

  const handleDecrement = () => {
    commitValue(value - stepSize);
  };

  const handleIncrement = () => {
    commitValue(value + stepSize);
  };

  const getRangePercentage = () => {
    const totalRange = maxValue - startingValue;
    if (totalRange === 0) return 0;
    return ((value - startingValue) / totalRange) * 100;
  };

  return (
    <>
      <motion.div
        onHoverStart={() => animate(scale, 1.2)}
        onHoverEnd={() => animate(scale, 1)}
        onTouchStart={() => animate(scale, 1.2)}
        onTouchEnd={() => animate(scale, 1)}
        style={{
          scale,
          opacity: useTransform(scale, [1, 1.2], [0.7, 1]),
        }}
        className="slider-wrapper"
      >
        <motion.div
          animate={{
            scale: region === 'left' ? [1, 1.4, 1] : 1,
            transition: { duration: 0.25 },
          }}
          style={{
            x: useTransform(() => (region === 'left' ? -overflow.get() / scale.get() : 0)),
          }}
        >
          <button
            type="button"
            className="slider-step-button"
            onClick={handleDecrement}
            aria-label="Decrease value"
          >
            {leftIcon}
          </button>
        </motion.div>

        <div
          ref={sliderRef}
          className="slider-root"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        >
          <motion.div
            style={{
              scaleX: useTransform(() => {
                if (sliderRef.current) {
                  const { width } = sliderRef.current.getBoundingClientRect();
                  return 1 + overflow.get() / width;
                }
                return 1;
              }),
              scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]),
              transformOrigin: useTransform(() => {
                if (sliderRef.current) {
                  const { left, width } = sliderRef.current.getBoundingClientRect();
                  return clientX.get() < left + width / 2 ? 'right' : 'left';
                }
                return 'left';
              }),
              height: useTransform(scale, [1, 1.2], [6, 12]),
              marginTop: useTransform(scale, [1, 1.2], [0, -3]),
              marginBottom: useTransform(scale, [1, 1.2], [0, -3]),
            }}
            className="slider-track-wrapper"
          >
            <div className="slider-track">
              <div className="slider-range" style={{ width: `${getRangePercentage()}%` }} />
            </div>
          </motion.div>
        </div>

        <motion.div
          animate={{
            scale: region === 'right' ? [1, 1.4, 1] : 1,
            transition: { duration: 0.25 },
          }}
          style={{
            x: useTransform(() => (region === 'right' ? overflow.get() / scale.get() : 0)),
          }}
        >
          <button
            type="button"
            className="slider-step-button"
            onClick={handleIncrement}
            aria-label="Increase value"
          >
            {rightIcon}
          </button>
        </motion.div>
      </motion.div>
      <p className="value-indicator">{formatValue ? formatValue(value) : Math.round(value)}</p>
    </>
  );
}

function decay(value: number, max: number) {
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
  return sigmoid * max;
}