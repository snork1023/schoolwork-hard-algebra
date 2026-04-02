import { useEffect, useRef } from "react";

const ShootingStars = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const stars: { x: number; y: number; speed: number; size: number; opacity: number; tail: number; angle: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawnStar = () => {
      // Angle between 0-8 degrees converted to radians
      const angleDeg = Math.random() * 8;
      const angleRad = (angleDeg * Math.PI) / 180;
      // Randomly go left or right
      const direction = Math.random() < 0.5 ? 1 : -1;

      stars.push({
        x: Math.random() * (canvas.width + 200) - 100,
        y: -20,
        speed: 8 + Math.random() * 12,
        size: 1 + Math.random() * 2,
        opacity: 0.4 + Math.random() * 0.4,
        tail: 20 + Math.random() * 40,
        angle: angleRad * direction,
      });
    };

    const animate = () => {
      const isDark = document.documentElement.classList.contains("dark");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let j = 0; j < 3; j++) {
        if (Math.random() < 0.5) spawnStar();
      }

      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        // Move along the angle
        s.x += Math.sin(s.angle) * s.speed;
        s.y += Math.cos(s.angle) * s.speed;

        const color = isDark ? "255,255,255" : "0,0,0";

        // Tail end position (opposite direction of travel)
        const tailX = s.x - Math.sin(s.angle) * s.tail;
        const tailY = s.y - Math.cos(s.angle) * s.tail;

        // Draw tail
        const gradient = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        gradient.addColorStop(0, `rgba(${color},${s.opacity})`);
        gradient.addColorStop(1, `rgba(${color},0)`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = s.size;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Draw star head
        ctx.fillStyle = `rgba(${color},${s.opacity})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        if (s.y > canvas.height + s.tail || s.x < -100 || s.x > canvas.width + 100) {
          stars.splice(i, 1);
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default ShootingStars;
