"use client";

import { useEffect, useState } from "react";

export type User = {
  email: string;
  displayName: string;
  dob: string; // ISO yyyy-mm-dd
  createdAt: number;
};

const USERS_KEY = "tv.users";
const SESSION_KEY = "tv.session";

function readUsers(): User[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as User[];
  } catch {
    return [];
  }
}

function writeUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function ageFromDob(dob: string, now = new Date()): number {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return NaN;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function signUp(input: {
  email: string;
  displayName: string;
  dob: string;
}): { ok: true; user: User } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (displayName.length < 2) {
    return { ok: false, error: "Display name must be at least 2 characters." };
  }
  const age = ageFromDob(input.dob);
  if (Number.isNaN(age)) {
    return { ok: false, error: "Enter a valid date of birth." };
  }
  if (age < 18) {
    return { ok: false, error: "TradeVerse is 18+ only." };
  }

  const users = readUsers();
  if (users.some((u) => u.email === email)) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const user: User = { email, displayName, dob: input.dob, createdAt: Date.now() };
  users.push(user);
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, email);
  return { ok: true, user };
}

export function signIn(email: string): { ok: true; user: User } | { ok: false; error: string } {
  const e = email.trim().toLowerCase();
  const user = readUsers().find((u) => u.email === e);
  if (!user) return { ok: false, error: "No account found. Sign up first." };
  localStorage.setItem(SESSION_KEY, e);
  return { ok: true, user };
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const email = localStorage.getItem(SESSION_KEY);
  if (!email) return null;
  return readUsers().find((u) => u.email === email) ?? null;
}

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
    setLoaded(true);
    const onStorage = () => setUser(getCurrentUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    user,
    loaded,
    signOut: () => {
      signOut();
      setUser(null);
    },
    refresh: () => setUser(getCurrentUser()),
  };
}
