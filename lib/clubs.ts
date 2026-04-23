"use client";

// Institute directory + user-created Clubs.
//
// Institutes are a curated seed list — CA institutes, IITs/NITs/IIMs,
// top commerce and B-schools. Clubs are user-created under an
// institute: e.g. "IIM-B Finance Club". Clubs host fests (Phase 10.2).
//
// Everything is client-side for now. Phase 12 swaps in a real backend.

export type InstituteCategory =
  | "IIT"
  | "NIT"
  | "IIM"
  | "B-School"
  | "Commerce"
  | "CA"
  | "Other";

export type Institute = {
  id: string;
  name: string;
  short: string; // IIT-B, IIM-A, etc.
  city: string;
  category: InstituteCategory;
};

export const INSTITUTES: Institute[] = [
  { id: "iit-bombay",      name: "Indian Institute of Technology Bombay",     short: "IIT-B",    city: "Mumbai",    category: "IIT" },
  { id: "iit-delhi",       name: "Indian Institute of Technology Delhi",      short: "IIT-D",    city: "Delhi",     category: "IIT" },
  { id: "iit-madras",      name: "Indian Institute of Technology Madras",     short: "IIT-M",    city: "Chennai",   category: "IIT" },
  { id: "iit-kanpur",      name: "Indian Institute of Technology Kanpur",     short: "IIT-K",    city: "Kanpur",    category: "IIT" },
  { id: "iit-kharagpur",   name: "Indian Institute of Technology Kharagpur",  short: "IIT-KGP",  city: "Kharagpur", category: "IIT" },
  { id: "iit-roorkee",     name: "Indian Institute of Technology Roorkee",    short: "IIT-R",    city: "Roorkee",   category: "IIT" },
  { id: "iit-guwahati",    name: "Indian Institute of Technology Guwahati",   short: "IIT-G",    city: "Guwahati",  category: "IIT" },
  { id: "nit-trichy",      name: "National Institute of Technology Trichy",   short: "NIT-T",    city: "Trichy",    category: "NIT" },
  { id: "nit-warangal",    name: "National Institute of Technology Warangal", short: "NIT-W",    city: "Warangal",  category: "NIT" },
  { id: "nit-surathkal",   name: "National Institute of Technology Karnataka",short: "NIT-K",    city: "Surathkal", category: "NIT" },
  { id: "iim-ahmedabad",   name: "Indian Institute of Management Ahmedabad",  short: "IIM-A",    city: "Ahmedabad", category: "IIM" },
  { id: "iim-bangalore",   name: "Indian Institute of Management Bangalore",  short: "IIM-B",    city: "Bangalore", category: "IIM" },
  { id: "iim-calcutta",    name: "Indian Institute of Management Calcutta",   short: "IIM-C",    city: "Kolkata",   category: "IIM" },
  { id: "iim-lucknow",     name: "Indian Institute of Management Lucknow",    short: "IIM-L",    city: "Lucknow",   category: "IIM" },
  { id: "iim-indore",      name: "Indian Institute of Management Indore",     short: "IIM-I",    city: "Indore",    category: "IIM" },
  { id: "isb-hyderabad",   name: "Indian School of Business",                 short: "ISB",      city: "Hyderabad", category: "B-School" },
  { id: "xlri-jamshedpur", name: "Xavier School of Management",               short: "XLRI",     city: "Jamshedpur",category: "B-School" },
  { id: "fms-delhi",       name: "Faculty of Management Studies, Delhi",      short: "FMS",      city: "Delhi",     category: "B-School" },
  { id: "nmims-mumbai",    name: "NMIMS School of Business Management",       short: "NMIMS",    city: "Mumbai",    category: "B-School" },
  { id: "srcc-delhi",      name: "Shri Ram College of Commerce",              short: "SRCC",     city: "Delhi",     category: "Commerce" },
  { id: "lsr-delhi",       name: "Lady Shri Ram College",                     short: "LSR",      city: "Delhi",     category: "Commerce" },
  { id: "hansraj-delhi",   name: "Hansraj College",                           short: "Hansraj",  city: "Delhi",     category: "Commerce" },
  { id: "hr-college",      name: "H.R. College of Commerce",                  short: "HR",       city: "Mumbai",    category: "Commerce" },
  { id: "st-xaviers",      name: "St. Xavier's College",                      short: "Xaviers",  city: "Mumbai",    category: "Commerce" },
  { id: "narsee-monjee",   name: "Narsee Monjee College of Commerce",         short: "NM",       city: "Mumbai",    category: "Commerce" },
  { id: "icai",            name: "Institute of Chartered Accountants of India", short: "ICAI",   city: "National",  category: "CA" },
  { id: "cma-icmai",       name: "Institute of Cost Accountants of India",    short: "ICMAI",    city: "National",  category: "CA" },
  { id: "cs-icsi",         name: "Institute of Company Secretaries of India", short: "ICSI",     city: "National",  category: "CA" },
];

export const CATEGORIES: InstituteCategory[] = [
  "IIT", "NIT", "IIM", "B-School", "Commerce", "CA", "Other",
];

export function getInstitute(id: string): Institute | null {
  return INSTITUTES.find((i) => i.id === id) ?? null;
}

// --- Clubs ---

export type Club = {
  id: string;
  instituteId: string;
  name: string;
  description?: string;
  createdBy: string; // email
  createdAt: number;
  members: { email: string; displayName: string; role: "owner" | "member"; joinedAt: number }[];
};

const CLUBS_KEY = "tv.clubs";
const MY_CLUBS_KEY = (email: string) => `tv.myclubs.${email}`;

function readClubs(): Club[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CLUBS_KEY) || "[]") as Club[];
  } catch {
    return [];
  }
}

function writeClubs(cs: Club[]) {
  localStorage.setItem(CLUBS_KEY, JSON.stringify(cs));
}

function readMembership(email: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(MY_CLUBS_KEY(email)) || "[]") as string[];
  } catch {
    return [];
  }
}

function writeMembership(email: string, ids: string[]) {
  localStorage.setItem(MY_CLUBS_KEY(email), JSON.stringify(ids));
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function listClubs(): Club[] {
  return readClubs().sort((a, b) => b.createdAt - a.createdAt);
}

export function clubsForInstitute(instituteId: string): Club[] {
  return readClubs()
    .filter((c) => c.instituteId === instituteId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function myClubs(email: string): Club[] {
  const ids = new Set(readMembership(email));
  return readClubs().filter(
    (c) => ids.has(c.id) || c.members.some((m) => m.email === email),
  );
}

export function getClub(id: string): Club | null {
  return readClubs().find((c) => c.id === id) ?? null;
}

export function createClub(input: {
  name: string;
  instituteId: string;
  description?: string;
  creator: { email: string; displayName: string };
}): { ok: true; club: Club } | { ok: false; error: string } {
  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Club name too short (min 3)." };
  if (name.length > 50) return { ok: false, error: "Club name too long (max 50)." };
  if (!getInstitute(input.instituteId))
    return { ok: false, error: "Pick a valid institute." };

  const club: Club = {
    id: genId(),
    instituteId: input.instituteId,
    name,
    description: input.description?.trim() || undefined,
    createdBy: input.creator.email,
    createdAt: Date.now(),
    members: [
      {
        email: input.creator.email,
        displayName: input.creator.displayName,
        role: "owner",
        joinedAt: Date.now(),
      },
    ],
  };
  const all = readClubs();
  all.push(club);
  writeClubs(all);

  const mem = readMembership(input.creator.email);
  if (!mem.includes(club.id)) mem.push(club.id);
  writeMembership(input.creator.email, mem);

  return { ok: true, club };
}

export function joinClub(
  clubId: string,
  user: { email: string; displayName: string },
): { ok: true; club: Club } | { ok: false; error: string } {
  const all = readClubs();
  const club = all.find((c) => c.id === clubId);
  if (!club) return { ok: false, error: "Club not found." };
  if (club.members.some((m) => m.email === user.email)) {
    return { ok: true, club };
  }
  if (club.members.length >= 200) {
    return { ok: false, error: "Club has reached its 200-member cap." };
  }
  club.members.push({
    email: user.email,
    displayName: user.displayName,
    role: "member",
    joinedAt: Date.now(),
  });
  writeClubs(all);

  const mem = readMembership(user.email);
  if (!mem.includes(club.id)) mem.push(club.id);
  writeMembership(user.email, mem);

  return { ok: true, club };
}

export function leaveClub(clubId: string, email: string): boolean {
  const all = readClubs();
  const club = all.find((c) => c.id === clubId);
  if (!club) return false;
  club.members = club.members.filter((m) => m.email !== email);
  writeClubs(all);
  const mem = readMembership(email).filter((id) => id !== clubId);
  writeMembership(email, mem);
  return true;
}
