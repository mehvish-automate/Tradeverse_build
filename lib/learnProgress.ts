"use client";

import { TRACKS, Track, totalLessonCount } from "./learn";

const KEY = (email: string) => `tv.learn.${email}`;

type LearnStore = {
  completed: string[]; // lesson ids
};

function read(email: string): LearnStore {
  if (typeof window === "undefined") return { completed: [] };
  try {
    return JSON.parse(localStorage.getItem(KEY(email)) || '{"completed":[]}');
  } catch {
    return { completed: [] };
  }
}

function write(email: string, store: LearnStore) {
  localStorage.setItem(KEY(email), JSON.stringify(store));
}

export function completedSet(email: string): Set<string> {
  return new Set(read(email).completed);
}

export function markComplete(email: string, lessonId: string) {
  const store = read(email);
  if (!store.completed.includes(lessonId)) {
    store.completed.push(lessonId);
    write(email, store);
  }
}

/**
 * A lesson is unlocked when every lesson before it in the same track is
 * complete. The first lesson of every track is always unlocked.
 */
export function isLessonUnlocked(
  email: string,
  trackId: string,
  lessonId: string,
): boolean {
  const track = TRACKS.find((t) => t.id === trackId);
  if (!track) return false;
  const done = completedSet(email);
  const idx = track.lessons.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return true;
  for (let i = 0; i < idx; i++) {
    if (!done.has(track.lessons[i].id)) return false;
  }
  return true;
}

export function trackCompletion(email: string, track: Track): {
  done: number;
  total: number;
  pct: number;
} {
  const done = completedSet(email);
  const total = track.lessons.length;
  const doneCount = track.lessons.filter((l) => done.has(l.id)).length;
  return {
    done: doneCount,
    total,
    pct: total === 0 ? 0 : Math.round((doneCount / total) * 100),
  };
}

export function overallCompletion(email: string): {
  done: number;
  total: number;
  pct: number;
} {
  const total = totalLessonCount();
  const done = completedSet(email).size;
  return {
    done,
    total,
    pct: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/**
 * The next recommended lesson is the first un-completed lesson walking the
 * tracks in order. null if everything is done.
 */
export function nextLesson(email: string): {
  track: Track;
  lessonId: string;
} | null {
  const done = completedSet(email);
  for (const track of TRACKS) {
    for (const lesson of track.lessons) {
      if (!done.has(lesson.id)) return { track, lessonId: lesson.id };
    }
  }
  return null;
}
