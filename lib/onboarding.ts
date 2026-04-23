"use client";

const KEY = (email: string) => `tv.onboarded.${email}`;

export function hasOnboarded(email: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY(email)) === "1";
}

export function markOnboarded(email: string) {
  localStorage.setItem(KEY(email), "1");
}

const INST_KEY = (email: string) => `tv.homeInstitute.${email}`;

export function getHomeInstitute(email: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(INST_KEY(email));
}

export function setHomeInstitute(email: string, instituteId: string) {
  localStorage.setItem(INST_KEY(email), instituteId);
}
