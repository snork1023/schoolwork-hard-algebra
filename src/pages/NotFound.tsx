import { useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Static stars
    const staticStars: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < 200; i++) {
      staticStars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.2,
        o: Math.random() * 0.7 + 0.3,
      });
    }

    // Shooting stars
    type Shooter = { x: number; y: number; len: number; speed: number; angle: number; opacity: number };
    const shooters: Shooter[] = [];

    const spawnShooter = (): Shooter => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      len: Math.random() * 120 + 60,
      speed: Math.random() * 8 + 6,
      angle: Math.PI / 5,
      opacity: 1,
    });

    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Static stars
      for (const s of staticStars) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.o})`;
        ctx.fill();
      }

      // Spawn a new shooter occasionally
      if (frame % 55 === 0) shooters.push(spawnShooter());

      // Draw & update shooting stars
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        const dx = Math.cos(s.angle) * s.speed;
        const dy = Math.sin(s.angle) * s.speed;

        const grad = ctx.createLinearGradient(
          s.x, s.y,
          s.x - Math.cos(s.angle) * s.len,
          s.y - Math.sin(s.angle) * s.len
        );
        grad.addColorStop(0, `rgba(255,255,255,${s.opacity})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - Math.cos(s.angle) * s.len, s.y - Math.sin(s.angle) * s.len);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        s.x += dx;
        s.y += dy;
        s.opacity -= 0.012;

        if (s.opacity <= 0 || s.x > canvas.width || s.y > canvas.height) {
          shooters.splice(i, 1);
        }
      }

      frame++;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={s.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .home-btn:hover {
          background: rgba(255,255,255,0.12) !important;
          color: #fff !important;
        }
      `}</style>

      <canvas ref={canvasRef} style={s.canvas} />

      <div style={s.content}>
        <h1 style={s.heading}>404</h1>
        <p style={s.sub}>Page not found</p>
        <button className="home-btn" style={s.btn} onClick={() => navigate("/")}>
          Return Home
        </button>
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  root: {
    position: "relative",
    minHeight: "100vh",
    backgroundColor: "#05060f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  canvas: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
  },
  content: {
    position: "relative",
    zIndex: 1,
    textAlign: "center",
    animation: "fadeIn 0.8s ease forwards",
  },
  heading: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "clamp(5rem, 15vw, 9rem)",
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 0.25rem",
    letterSpacing: "0.05em",
  },
  sub: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "clamp(0.9rem, 2vw, 1.1rem)",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    margin: "0 0 2.5rem",
  },
  btn: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "0.8rem",
    letterSpacing: "0.15em",
    color: "rgba(255,255,255,0.7)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.2)",
    padding: "0.8rem 2rem",
    cursor: "pointer",
    transition: "background 0.25s, color 0.25s",
  },
};

export default NotFound;
