import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  type User as FirebaseAuthUser,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/integrations/firebase/client";

export interface FirebaseAuthState {
  user: FirebaseAuthUser | null;
  ready: boolean;
  configured: boolean;
}

export function useFirebaseAuth(): FirebaseAuthState {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [ready, setReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!auth) {
      setReady(true);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  return { user, ready, configured: isFirebaseConfigured };
}

export async function signOutFirebase(): Promise<void> {
  if (!auth) return;
  await fbSignOut(auth);
}
