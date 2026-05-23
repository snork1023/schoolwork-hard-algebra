import { Sparkles, Database, Copy, ExternalLink, Check, ShieldAlert } from "lucide-react";
import { useState } from "react";
import Navigation from "@/components/Navigation";

const ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }

    match /users/{uid} {
      allow read: if signedIn();
      allow create, update: if signedIn() && request.auth.uid == uid;
    }

    match /friendships/{id} {
      allow read: if signedIn() && request.auth.uid in resource.data.userIds;
      allow create: if signedIn() && request.auth.uid in request.resource.data.userIds;
      allow update, delete: if signedIn() && request.auth.uid in resource.data.userIds;
    }

    match /servers/{id} {
      allow read: if signedIn();
      allow create: if signedIn() && request.auth.uid == request.resource.data.ownerId;
      allow update: if signedIn();
      allow delete: if signedIn() && request.auth.uid == resource.data.ownerId;
    }

    match /channels/{id} {
      allow read: if signedIn();
      allow create, update, delete: if signedIn();
    }

    match /chats/{id} {
      allow read: if signedIn() && request.auth.uid in resource.data.memberIds;
      allow create: if signedIn() && request.auth.uid in request.resource.data.memberIds;
      allow update, delete: if signedIn() && request.auth.uid in resource.data.memberIds;
    }

    match /messages/{id} {
      allow read: if signedIn();
      allow create: if signedIn() && request.auth.uid == request.resource.data.authorId;
      allow update, delete: if signedIn() && request.auth.uid == resource.data.authorId;
    }

    match /calls/{callId} {
      allow read: if signedIn() && request.auth.uid in resource.data.targetMemberIds;
      allow create: if signedIn()
        && request.auth.uid == request.resource.data.initiatorId
        && request.auth.uid in request.resource.data.targetMemberIds;
      allow update, delete: if signedIn() && request.auth.uid in resource.data.targetMemberIds;

      match /signals/{signalId} {
        allow read: if signedIn();
        allow create: if signedIn() && request.auth.uid == request.resource.data.from;
        allow delete: if signedIn();
      }
    }
  }
}`;

const STORAGE_RULES = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{uid} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
    match /servers/{serverId}/{filename} {
      allow read: if true;
      allow write: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}`;

export function FirebaseSetup() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="pt-20">
        <header className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Chime</span>
        </header>

        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="rounded-2xl bg-card p-8 shadow-glow ring-1 ring-border">
            <div className="flex items-center gap-2 text-primary">
              <Database className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-widest">
                Set up Firebase
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-foreground">
              Connect Chime to your Firebase project
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Chime needs Firebase Auth, Firestore, and Storage. Add the env vars below
              and reload.
            </p>

            <div className="mt-5 flex items-start gap-3 rounded-xl bg-destructive/5 px-4 py-3 ring-1 ring-destructive/20">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="text-sm text-foreground">
                <strong className="text-destructive">Lock down billing before you go live.</strong>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  <li>Set a <strong>Firebase budget alert</strong> (Billing → Budgets &amp; alerts).</li>
                  <li>Enable <strong>App Check with reCAPTCHA Enterprise</strong> on Auth, Firestore, and Storage to block bots.</li>
                  <li>Turn on <strong>Identity Toolkit quotas</strong> in Google Cloud Console to cap sign-up attempts/IP.</li>
                  <li>Restrict the <strong>API key</strong> to your domain in Google Cloud Console → Credentials.</li>
                </ul>
              </div>
            </div>

            <ol className="mt-6 space-y-5 text-sm text-foreground">
              <li>
                <div className="flex items-center gap-2 font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/40 text-xs text-foreground">
                    1
                  </span>
                  Create a Firebase project
                </div>
                <p className="mt-1 ml-8 text-muted-foreground">
                  Go to{" "}
                  <a
                    className="text-primary underline hover:text-primary/80"
                    href="https://console.firebase.google.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    console.firebase.google.com
                    <ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>{" "}
                  and create a new project (any name).
                </p>
              </li>

              <li>
                <div className="flex items-center gap-2 font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/40 text-xs text-foreground">
                    2
                  </span>
                  Enable Auth + Firestore + Storage
                </div>
                <ul className="ml-8 mt-1 list-disc space-y-0.5 text-muted-foreground">
                  <li>Authentication → Sign-in method → enable Email/Password</li>
                  <li>Build → Firestore Database → Create database</li>
                  <li>Build → Storage → Get started</li>
                </ul>
              </li>

              <li>
                <div className="flex items-center gap-2 font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/40 text-xs text-foreground">
                    3
                  </span>
                  Register a Web app and copy the config to .env
                </div>
                <p className="ml-8 mt-1 text-muted-foreground">
                  Project settings → Your apps → Web. Add these to a{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env</code> file at the project root:
                </p>
                <div className="ml-8 mt-3 rounded-xl bg-muted p-3 ring-1 ring-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      .env
                    </span>
                    <button
                      onClick={() =>
                        copy("env", ENV_KEYS.map((k) => `${k}=`).join("\n"))
                      }
                      className="flex items-center gap-1 rounded-md bg-card px-2 py-1 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-accent/40"
                    >
                      {copied === "env" ? (
                        <>
                          <Check className="h-3 w-3" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy keys
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-foreground">
{ENV_KEYS.map((k) => `${k}=`).join("\n")}
                  </pre>
                </div>
              </li>

              <li>
                <div className="flex items-center gap-2 font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/40 text-xs text-foreground">
                    4
                  </span>
                  Paste these security rules
                </div>
                <p className="ml-8 mt-1 text-muted-foreground">Firestore → Rules tab:</p>
                <div className="ml-8 mt-3 rounded-xl bg-muted p-3 ring-1 ring-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Firestore rules
                    </span>
                    <button
                      onClick={() => copy("fs", RULES)}
                      className="flex items-center gap-1 rounded-md bg-card px-2 py-1 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-accent/40"
                    >
                      {copied === "fs" ? (
                        <>
                          <Check className="h-3 w-3" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre text-[11px] leading-relaxed text-foreground">
{RULES}
                  </pre>
                </div>
                <p className="ml-8 mt-3 text-muted-foreground">Storage → Rules tab:</p>
                <div className="ml-8 mt-2 rounded-xl bg-muted p-3 ring-1 ring-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Storage rules
                    </span>
                    <button
                      onClick={() => copy("st", STORAGE_RULES)}
                      className="flex items-center gap-1 rounded-md bg-card px-2 py-1 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-accent/40"
                    >
                      {copied === "st" ? (
                        <>
                          <Check className="h-3 w-3" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre text-[11px] leading-relaxed text-foreground">
{STORAGE_RULES}
                  </pre>
                </div>
              </li>

              <li>
                <div className="flex items-center gap-2 font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/40 text-xs text-foreground">
                    5
                  </span>
                  Restart the dev server
                </div>
                <p className="ml-8 mt-1 text-muted-foreground">
                  Reload this page and you should land on the Chime app. Sign up
                  with your first account and start building your servers!
                </p>
              </li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}
