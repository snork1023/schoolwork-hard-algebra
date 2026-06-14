import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
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
          <h1 style={s.heading}>Privacy Policy</h1>
          <p style={s.sub}>Last Updated: June 13, 2026</p>

          <div style={s.body}>
            <p style={s.paragraph}>
              Welcome to Kepler ("we," "our," or "us"). We are committed to absolute transparency and the highest standards of data stewardship regarding how your information is collected, managed, and safeguarded on our communication platform.
            </p>
            <p style={s.paragraph}>
              By creating an account, initializing an authentication session, or utilizing our real-time messaging systems, you explicitly acknowledge you have read, understood, and consented to the data collection, functional local storage usage, and rolling automated erasure mechanics detailed within this Privacy Policy.
            </p>

            <h2 style={s.sectionHeading}>1. Information We Collect and Manage</h2>
            <p style={s.paragraph}>
              To facilitate real-time interactions, secure account provisioning, and operational stability, we process the following categories of data:
            </p>

            <h3 style={s.subHeading}>A. Account Registration Metadata</h3>
            <ul style={s.list}>
              <li style={s.listItem}>
                <strong>Email Address:</strong> Collected during registration to authenticate your access state, confirm unique user accounts, protect against sybil registration attacks, and distribute critical infrastructure updates or security notices.
              </li>
              <li style={s.listItem}>
                <strong>Username:</strong> A public-facing identity marker selected by you to establish your visible profile across threads, communication panels, and community channels.
              </li>
            </ul>

            <h3 style={s.subHeading}>B. Passwords and authentication</h3>
            <ul style={s.list}>
              <li style={s.listItem}>
                <strong>Secure Authentication System:</strong> During account creation, a password is collected to establish and gate your personal access profile.
              </li>
              <li style={s.listItem}>
                <strong>Zero-Knowledge Password Protection:</strong> All passwords undergo an irreversible cryptographic hashing process immediately upon submission before being written to our storage layers. <strong>Passwords are never stored in plain text, and are never viewable by, shared with, or accessible to the project owners, core developers, system administrators, or any external entities.</strong>
              </li>
            </ul>

            <h3 style={s.subHeading}>C. Communication Content, Media, and Interactivity Components</h3>
            <ul style={s.list}>
              <li style={s.listItem}>
                <strong>Chat Message Data:</strong> We temporarily index and store the text strings of your transmitted chat messages, direct communications, and group conversations to synchronize real-time updates across your active devices.
              </li>
              <li style={s.listItem}>
                <strong>Multimedia and Attachments:</strong> We securely manage files, images, graphics, audio strings, and voice recordings transmitted through our custom file uploading modules.
              </li>
              <li style={s.listItem}>
                <strong>Interactive Features:</strong> We collect participation parameters including custom status updates, active presence indicators, read receipts, text reactions, and interactive poll metadata (questions, selected options, and vote counts).
              </li>
            </ul>

            <h2 style={s.sectionHeading}>2. Data Storage, Isolation, and Advanced Access Controls</h2>
            <p style={s.paragraph}>
              We protect your conversations and media assets through rigid server-side configuration parameters, encryption layers, and environment isolation:
            </p>
            <ul style={s.list}>
              <li style={s.listItem}><strong>Encryption in Transit:</strong> All interactions, alphanumeric data packets, and binary assets are fully encrypted in transit between your client browser and our infrastructure using industry-standard HTTPS and Transport Layer Security (TLS) protocol layers.</li>
              <li style={s.listItem}><strong>Network Perimeter Isolation:</strong> Your communication histories, metadata tables, and account registries are maintained inside isolated private cloud servers protected behind enterprise-grade network firewalls. This infrastructure is entirely disconnected from the public internet, completely preventing external web crawlers, automated data scrapers, or public search engines from discovering or indexing your data.</li>
              <li style={s.listItem}><strong>Strict Role-Based Access Controls:</strong> All stored messaging text, data tables, and structural rows are guarded by advanced backend infrastructure-level access restrictions. <strong>Only authenticated administrators of Kepler hold the internal security credentials necessary to view or audit chat attachments and associated communications.</strong> No unauthenticated user, external entity, or third party can access or traverse these secure assets.</li>
              <li style={s.listItem}><strong>No Third-Party Distribution:</strong> We do not sell, rent, trade, or distribute your messages, emails, or usernames to any advertising networks, corporate data brokers, or third-party marketing firms.</li>
            </ul>

            <h2 style={s.sectionHeading}>3. Automated Data Retention & Cascading Erasure Policies</h2>
            <p style={s.paragraph}>
              Kepler operates under a strict, automated <strong>minimal-retention framework</strong> designed to maintain an ephemeral, secure, and lightweight communication environment.
            </p>
            <ul style={s.list}>
              <li style={s.listItem}><strong>Automated 3-Day Purge Lifecycle:</strong> To ensure your conversational footprints remain transient and private, the platform enforces a rolling <strong>three (3) day data-retention schedule</strong>. All chat messages, multimedia file attachments, interactive polls, votes, and reactions are automatically and permanently deleted from our server architecture exactly three (3) days after their precise creation timestamp.</li>
              <li style={s.listItem}><strong>Automated Cascading Erasure:</strong> When a message or a conversation thread hits its 3-day expiration limit, an automated, system-level cascading database directive fires instantly. This ensures that all contextual dependencies (including message read receipts, user reactions, poll options, and storage file allocation markers) are automatically purged alongside the parent message. No orphaned metadata or residual conversational elements remain on our server tables.</li>
            </ul>

            <h2 style={s.sectionHeading}>4. Data Control and Permanent Self-Service Deletion</h2>
            <ul style={s.list}>
              <li style={s.listItem}><strong>Self-Service Account Termination:</strong> Users can permanently delete their profiles at any time. By navigating to your account dashboard and utilizing the <strong>Account Delete</strong> option located directly within your <strong>User Settings</strong> panel, a permanent account erasure directive is immediately dispatched.</li>
              <li style={s.listItem}><strong>Instant and Permanent Account Purging:</strong> Executing an account termination immediately and irreversibly purges your signup email address, public profile username, relationship logs, and all associated account metadata from our tables. This operation is definitive and non-recoverable.</li>
            </ul>

            <h2 style={s.sectionHeading}>5. Mandatory Regulatory Disclosures</h2>
            <p style={s.paragraph}>
              To comply with domestic and global data protection frameworks (including GDPR, CCPA, and COPPA), we outline the following user parameters:
            </p>
            <h3 style={s.subHeading}>A. Cookies and Local Storage Infrastructure</h3>
            <p style={s.paragraph}>
              Kepler does not deploy marketing, advertising, or third-party behavioral tracking cookies. However, to authenticate your account and preserve active login sessions across browser tabs, our system utilizes standard functional <code>localStorage</code> tokens. These session identifiers are strictly operational and necessary to deliver the application's real-time messaging services.
            </p>
            <h3 style={s.subHeading}>B. Children’s Privacy Safeguards</h3>
            <p style={s.paragraph}>
              Kepler does not knowingly collect, index, or request personal registration metadata (such as emails or usernames) from individuals under the age of 13. If we discover that an account has been registered by a minor under 13 without verifiable parental oversight, our administrative desk will execute an immediate, cascading erasure of all account and communication histories.
            </p>
            <h3 style={s.subHeading}>C. Regional Jurisdictional Protections (GDPR / CCPA)</h3>
            <p style={s.paragraph}>
              Depending on your geographic region, you may possess specific legal rights regarding your personal information, including the right to request a structural copy of the account parameters we hold, object to processing states, or request erasure. Because our architecture operates on an automated rolling 3-day deletion system, much of your conversational content is permanently self-purged. For any manual data rights requests, please submit them through <a href="https://forms.gle/XjjY2tYjxHneRWfn6" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>this form</a>.
            </p>

            <h2 style={s.sectionHeading}>6. Amendments to This Policy</h2>
            <p style={s.paragraph}>
              We reserve the right to revise this Privacy Policy to align with technological updates, adjustments to our database architecture, or evolving system safety demands. Any revisions to this policy will be signaled by updating the "Last Updated" date located at the top of this statement.
            </p>

            <h2 style={s.sectionHeading}>7. Inquiries and Administrative Support</h2>
            <p style={s.paragraph}>
              For technical troubleshooting, security assessments, or inquiries regarding our automated rolling erasure mechanics, contact our data administration desk:
            </p>
            <p style={s.paragraph}>
              For all inquiries and administrative support, please use <a href="https://forms.gle/XjjY2tYjxHneRWfn6" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>this contact form</a>.
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
  subHeading: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "clamp(1rem, 1.6vw, 1.2rem)",
    color: "rgba(255,255,255,0.87)",
    margin: "0.5rem 0 0.5rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
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

export default PrivacyPolicy;
