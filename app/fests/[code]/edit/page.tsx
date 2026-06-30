"use client";

// Edit a quiz/event (host or admin). Useful for admins fixing details
// before approving. Editing keeps the current lifecycle status (a pending
// quiz stays pending). Custom questions are edited from the launcher; this
// covers the metadata + schedule + rewards.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Fest, FestDifficulty, FestPrivacy, getFest, updateFest } from "@/lib/fests";
import { REWARD_TEMPLATES, templateById, tiersSummary } from "@/lib/rewardTiers";
import { useSession } from "@/lib/session";
import { isAdminLocal } from "@/lib/supabase/sync";

function toLocalInput(ms?: number, dateStr?: string): string {
  const d = ms ? new Date(ms) : dateStr ? new Date(dateStr) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditFestPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const router = useRouter();
  const { user } = useSession();
  const params = useParams<{ code: string }>();
  const code = params?.code ? String(params.code).toUpperCase() : "";

  const [fest, setFest] = useState<Fest | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<FestPrivacy>("private");
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [memberCap, setMemberCap] = useState(50);
  const [difficulty, setDifficulty] = useState<FestDifficulty>("intermediate");
  const [categoriesInput, setCategoriesInput] = useState("");
  const [rewardChoice, setRewardChoice] = useState("keep");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!code) return;
    const f = getFest(code);
    setFest(f ?? null);
    if (f) {
      setName(f.name);
      setDescription(f.description ?? "");
      setPrivacy(f.privacy ?? "private");
      setStartStr(toLocalInput(f.startsAtMs, f.startDate));
      setEndStr(toLocalInput(f.endsAtMs, f.endDate));
      setMemberCap(f.memberCap ?? 50);
      setDifficulty(f.difficulty ?? "intermediate");
      setCategoriesInput((f.categories ?? []).join(", "));
    }
  }, [code]);

  const canEdit = useMemo(() => {
    if (!fest || !user) return false;
    return fest.createdBy === user.email || isAdminLocal(user.email);
  }, [fest, user]);

  if (!user || fest === undefined) return null;
  if (fest === null) {
    return <Shell title="Not found">No event matches that code on this device.</Shell>;
  }
  if (!canEdit) {
    return (
      <Shell title="Can't edit this">
        Only the host or an admin can edit this event.
      </Shell>
    );
  }

  function save() {
    const startsAtMs = new Date(startStr).getTime();
    const endsAtMs = new Date(endStr).getTime();
    const categories = categoriesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 12);
    const patch: Partial<Fest> = {
      name: name.trim(),
      description: description.trim() || undefined,
      privacy,
      memberCap,
      difficulty,
      categories,
      startDate: startStr.slice(0, 10),
      endDate: endStr.slice(0, 10),
      startsAtMs: Number.isFinite(startsAtMs) ? startsAtMs : undefined,
      endsAtMs: Number.isFinite(endsAtMs) ? endsAtMs : undefined,
    };
    if (rewardChoice !== "keep") {
      patch.rewards = templateById(rewardChoice)?.tiers ?? [];
    }
    updateFest(fest!.id, patch);
    setSaved(true);
    setTimeout(() => router.push(`/fests/${fest!.id}`), 700);
  }

  return (
    <>
      <div className="mb-2 text-xs">
        <Link href={`/fests/${fest.id}`} className="text-ink-400 hover:text-ink-100">
          ← {fest.name}
        </Link>
      </div>
      <h1 className="text-3xl font-semibold">Edit event</h1>
      <p className="mt-1 text-sm text-ink-400">
        Status stays <strong>{fest.lifecycleStatus ?? "live"}</strong>. Custom
        questions are edited from the launcher.
      </p>

      <div className="mt-6 space-y-4">
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Pitch (optional)">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} />
        </Field>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Starts">
            <input type="datetime-local" className="input" value={startStr} onChange={(e) => setStartStr(e.target.value)} />
          </Field>
          <Field label="Ends">
            <input type="datetime-local" className="input" value={endStr} onChange={(e) => setEndStr(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Privacy">
            <select className="input" value={privacy} onChange={(e) => setPrivacy(e.target.value as FestPrivacy)}>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </Field>
          <Field label="Difficulty">
            <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as FestDifficulty)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </Field>
        </div>
        <Field label={`Participant cap — ${memberCap}`}>
          <input type="range" min={2} max={1000} value={memberCap} onChange={(e) => setMemberCap(Number(e.target.value))} className="w-full" />
        </Field>
        <Field label="Categories (comma-separated)">
          <input className="input" value={categoriesInput} onChange={(e) => setCategoriesInput(e.target.value)} />
        </Field>
        <Field label="Rewards">
          <select className="input" value={rewardChoice} onChange={(e) => setRewardChoice(e.target.value)}>
            <option value="keep">
              Keep current ({tiersSummary(fest.rewards ?? [])})
            </option>
            {REWARD_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} className="btn-primary">
          {saved ? "Saved ✓" : "Save changes"}
        </button>
        <Link href={`/fests/${fest.id}`} className="btn-ghost">
          Cancel
        </Link>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-300">{label}</span>
      {children}
    </label>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-ink-400">{children}</p>
      <Link href="/quizzes" className="mt-4 inline-block btn-ghost">
        Quiz Floor
      </Link>
    </div>
  );
}
