import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile, RoleName } from "../types";

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  profileState: "idle" | "loading" | "ready" | "missing";
  blocked: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string): Promise<Profile | null> {
  const profileResult = await supabase.from("profiles").select("id, full_name, email, active, role_id").eq("id", userId).maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const row = profileResult.data as Omit<Profile, "role"> | null;
  if (!row) return null;
  const roleResult = await supabase.from("roles").select("name").eq("id", row.role_id).maybeSingle();
  if (roleResult.error) throw roleResult.error;
  const roleName = (roleResult.data as { name?: RoleName } | null)?.name;
  return { ...row, role: roleName === "administrador" ? "administrador" : "operador" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileState, setProfileState] = useState<AuthContextValue["profileState"]>("idle");
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      setProfile(null);
      setProfileState("idle");
      return;
    }

    let cancelled = false;
    setProfileState("loading");
    void loadProfile(session.user.id)
      .then((next) => {
        if (cancelled) return;
        if (next && !next.active) {
          setBlocked("Esta cuenta de personal está inactiva.");
          setProfile(null);
          setProfileState("idle");
          void supabase.auth.signOut();
          return;
        }
        setProfile(next);
        setProfileState(next ? "ready" : "missing");
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setProfileState("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [ready, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      profile,
      profileState,
      blocked,
      signIn: async (email, password) => {
        setBlocked(null);
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (!error) return null;
        if (/confirm/i.test(error.message)) return "Falta confirmar el correo. En Supabase puedes desactivar la confirmación para el entorno de prueba.";
        return "Correo o contraseña incorrectos.";
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [ready, session, profile, profileState, blocked],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
