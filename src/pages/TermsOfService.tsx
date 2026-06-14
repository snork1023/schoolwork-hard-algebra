import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const TermsOfService = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

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

    const staticStars: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < 200; i++) {
      staticStars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.2,
        o: Math.random() * 0.7 + 0.3,
      });
    }

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

      for (const s of staticStars) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.o})`;
        ctx.fill();
      }

      if (frame % 55 === 0) shooters.push(spawnShooter());

      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        const dx = Math.cos(s.angle) * s.speed;
        const dy = Math.sin(s.angle) * s.speed;

        const grad = ctx.createLinearGradient(
          s.x,
          s.y,
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
        <div style={s.card}>
          <h1 style={s.heading}>Terms of Service</h1>
          <p style={s.sub}>Last Updated: June 13, 2026</p>

          <div style={s.body}>
            <p style={s.paragraph}>
              Welcome to Kepler ("we," "our," or "us"). By creating an account, accessing our applications, or utilizing our real-time messaging services, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you are prohibited from using the platform.
            </p>

            <h2 style={s.sectionHeading}>1. Mandatory Affirmative Agreement (Click-Wrap Contract)</h2>
            <ul style={s.list}>
              <li style={s.listItem}><strong>Binding Acknowledgment:</strong> Account creation and entry into Kepler requires an absolute, affirmative agreement to these Terms. During the registration process, you will be presented with a mandatory interface selection box. <strong>By checking the box stating "I have read, understood, and agree to Kepler's Terms of Service and Privacy Policy," you are executing a legally binding digital contract with us.</strong></li>
              <li style={s.listItem}><strong>Pre-requisite for Access:</strong> If you do not check this affirmative box, our authentication layer will reject the subscription payload, account generation will be aborted, and no database profile will be created. Continued use of the service constitutes ongoing assent to these Terms.</li>
            </ul>

            <h2 style={s.sectionHeading}>2. Account Eligibility and Security</h2>
            <ul style={s.list}>
              <li style={s.listItem}><strong>Eligibility:</strong> You must be at least 13 years old (or the legal age of digital consent in your jurisdiction) to execute the affirmative agreement and establish an account.</li>
              <li style={s.listItem}><strong>Account Security:</strong> You are entirely responsible for maintaining the confidentiality of your account credentials. You agree to accept full responsibility for all activities, messages, and content transmissions that occur under your account username.</li>
              <li style={s.listItem}><strong>Administrative Action:</strong> We reserve the absolute right to suspend, rename, or reclaim usernames that are deemed misleading, offensive, malicious, or infringing on intellectual property rights.</li>
            </ul>

            <h2 style={s.sectionHeading}>3. Acceptable Use and Prohibited Conduct</h2>
            <p style={s.paragraph}>
              Kepler is designed to be a safe, high-performance community space. You agree that you will not use our platform to:
            </p>
            <ul style={s.list}>
              <li style={s.listItem}><strong>Upload Malicious Material:</strong> Transmit any software viruses, malware, trojan horses, or corrupt files designed to disrupt server infrastructure or compromise client devices.</li>
              <li style={s.listItem}><strong>Harass or Abuse:</strong> Engage in stalking, bullying, harassment, hate speech, or the defamation of other platform participants.</li>
              <li style={s.listItem}><strong>Infringe Intellectual Property:</strong> Upload files, media, images, or audio assets that infringe upon third-party copyrights, trademarks, or patents.</li>
              <li style={s.listItem}><strong>Abuse System Infrastructure:</strong> Attempt to bypass our application rate limiters, flood database endpoints, spam presence tracking networks, reverse-engineer server-side Edge Functions, or deploy automated bots to scrape public profile data.</li>
              <li style={s.listItem}><strong>Distribute Illegal Content:</strong> Share or distribute pornographic, violent, exploitative, or otherwise illegal text strings or media.</li>
            </ul>

            <h2 style={s.sectionHeading}>4. Ephemeral Architecture and Data Disclaimers</h2>
            <p style={s.paragraph}>
              Please read this section carefully, as it governs how data is managed on our system architecture:
            </p>
            <ul style={s.list}>
              <li style={s.listItem}><strong>The Rolling 3-Day Purge:</strong> You acknowledge and agree that Kepler enforces a strict, automated <strong>three (3) day rolling retention limit</strong> on all conversational text, attachments, images, polls, and metadata.</li>
              <li style={s.listItem}><strong>No Long-Term Backup Guarantees:</strong> The platform is explicitly built to be an ephemeral, transient communication environment. <strong>We do not provide data archival, backup, or message retrieval services.</strong> <em>Zero Liability for Loss of Content:</em> Under no circumstances shall Kepler, its owners, or its developers be held liable for the deletion, erasure, or structural loss of any messages, file attachments, poll responses, or user status histories resulting from our automated rolling cleanup mechanics or manual database purges. You are solely responsible for saving copies of critical information outside of our platform.</li>
            </ul>

            <h2 style={s.sectionHeading}>5. File Storage and Attachment Policy</h2>
            <ul style={s.list}>
              <li style={s.listItem}><strong>Administrative Review:</strong> Because the platform relies on shared file infrastructure, all uploaded attachments, graphics, and voice notes are bounded by internal monitoring filters. You acknowledge that authenticated platform administrators retain the necessary infrastructure capabilities to audit or review attachments to ensure compliance with our platform rules and maintain network security.</li>
              <li style={s.listItem}><strong>Storage Allocation Limits:</strong> We reserve the right to enforce storage space caps, max message lengths, or file type restrictions on our storage buckets at any moment to preserve operational stability.</li>
            </ul>

            <h2 style={s.sectionHeading}>6. Account Termination and Deletion</h2>
            <ul style={s.list}>
              <li style={s.listItem}><strong>Termination by User (Self-Service):</strong> You have the right to leave the platform at any time. By executing the <strong>Account Delete</strong> feature inside your <strong>User Settings</strong>, you will trigger an instantaneous, permanent wipe of your username, email profile, and relational configurations. This action is definitive and non-recoverable.</li>
              <li style={s.listItem}><strong>Termination by Us:</strong> We reserve the absolute right, without prior notice or financial liability, to permanently terminate or suspend your account access if you violate any provision of these Terms, engage in behavior that threatens platform safety, or cause unexpected server resource depletion.</li>
            </ul>

            <h2 style={s.sectionHeading}>7. Disclaimer of Warranties</h2>
            <p style={s.paragraph}>
              KEPLER IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE PLATFORM WILL OPERATE UNINTERRUPTED, ERRORS WILL BE CORRECTED INSTANTLY, OR DATA TRANSMISSIONS WILL NEVER EXPERIENCE DELAYS OR PACKET DROP-OFFS. YOUR USE OF THE REAL-TIME CHAT ENGINE, FILE UPLOADER, AND AI INTERFACES IS ENTIRELY AT YOUR OWN RISK.
            </p>

            <h2 style={s.sectionHeading}>8. Limitation of Liability</h2>
            <p style={s.paragraph}>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL KEPLER, ITS OWNERS, ADMINISTRATORS, OR DEVELOPERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, LOSS OF DATA, OR LOSS OF BUSINESS USE, ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO, OR INABILITY TO ACCESS, OUR PLATFORM AND SERVICES.
            </p>

            <h2 style={s.sectionHeading}>9. Governing Law and Dispute Resolution</h2>
            <p style={s.paragraph}>
              These Terms and your use of Kepler shall be governed by and construed in accordance with the laws of your project’s primary operating jurisdiction, without regard to conflict of law principles. Any legal actions or proceedings arising directly out of these platform interactions shall be brought exclusively in the courts located within our administrative headquarters.
            </p>

            <h2 style={s.sectionHeading}>10. Contact Information</h2>
            <p style={s.paragraph}>
              If you have questions regarding these Terms, or if you need to report platform abuse, infrastructure concerns, or broken community guidelines, please use <a href="https://forms.gle/XjjY2tYjxHneRWfn6" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>this contact form</a>.
            </p>
          </div>

          <button className="home-btn" style={s.btn} onClick={() => navigate("/")}>
            Return Home
          </button>
        </div>
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
    padding: "2rem",
  },
  canvas: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
  },
  content: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "center",
    width: "100%",
    animation: "fadeIn 0.8s ease forwards",
  },
  card: {
    width: "100%",
    maxWidth: "980px",
    background: "rgba(5,6,15,0.92)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "1.25rem",
    padding: "2rem",
    boxShadow: "0 32px 80px rgba(0,0,0,0.2)",
    backdropFilter: "blur(18px)",
    textAlign: "center",
  },
  heading: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "clamp(2.8rem, 6vw, 4.5rem)",
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 0.5rem",
    letterSpacing: "0.08em",
  },
  sub: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "clamp(0.9rem, 1.2vw, 1rem)",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: "0.16em",
    margin: "0 0 1.75rem",
    textTransform: "uppercase",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    alignItems: "center",
  },
  sectionHeading: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "clamp(1.35rem, 2vw, 1.75rem)",
    color: "#fff",
    margin: "0",
    letterSpacing: "0.12em",
  },
  paragraph: {
    maxWidth: "860px",
    margin: "0 auto",
    color: "rgba(255,255,255,0.8)",
    fontSize: "clamp(0.95rem, 1.1vw, 1rem)",
    lineHeight: 1.8,
    textAlign: "center",
  },
  list: {
    maxWidth: "860px",
    margin: "0 auto",
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    textAlign: "left",
  },
  listItem: {
    color: "rgba(255,255,255,0.8)",
    fontSize: "clamp(0.95rem, 1.1vw, 1rem)",
    lineHeight: 1.8,
  },
  btn: {
    marginTop: "2rem",
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "0.9rem",
    letterSpacing: "0.15em",
    color: "rgba(255,255,255,0.85)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.2)",
    padding: "0.95rem 2rem",
    cursor: "pointer",
    transition: "background 0.25s, color 0.25s",
  },
};

export default TermsOfService;
