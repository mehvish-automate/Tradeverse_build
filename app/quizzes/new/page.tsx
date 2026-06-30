"use client";

// Standalone quiz launch flow — any authed user can host. Public OR
// private with cap > 100 routes through admin approval (/admin/fests).
// Builds on the fest model (createFest with clubId=null).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { COMPLIANCE_DISCLOSURE } from "@/lib/compliance";
import { REWARD_TEMPLATES, templateById, tiersSummary } from "@/lib/rewardTiers";
import {
  FEST_DIFFICULTIES,
  FestDifficulty,
  FestPrivacy,
  FestQuestion,
  FestSource,
  createFest,
  festNeedsAdminApproval,
} from "@/lib/fests";

export default function NewQuizPage() {
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

function defaultDateTimeLocal(offsetHours: number): string {
  const d = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Inner() {
  const router = useRouter();
  const { user } = useSession();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<FestPrivacy>("private");
  const [startStr, setStartStr] = useState(defaultDateTimeLocal(1));
  const [endStr, setEndStr] = useState(defaultDateTimeLocal(48));
  const [memberCap, setMemberCap] = useState(50);
  const [difficulty, setDifficulty] =
    useState<FestDifficulty>("intermediate");
  const [categoriesInput, setCategoriesInput] = useState("");
  const [source, setSource] = useState<FestSource>("system");
  const [rewardTemplate, setRewardTemplate] = useState("none");
  const [questions, setQuestions] = useState<FestQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const willNeedApproval = useMemo(
    () => festNeedsAdminApproval({ privacy, memberCap }),
    [privacy, memberCap],
  );

  if (!user) return null;

  function addBlankQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 10),
        prompt: "",
        options: ["", "", "", ""],
        answer: 0,
      },
    ]);
  }
  function updateQuestion(i: number, patch: Partial<FestQuestion>) {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)),
    );
  }
  function removeQuestion(i: number) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const startsAtMs = new Date(startStr).getTime();
    const endsAtMs = new Date(endStr).getTime();
    if (Number.isFinite(startsAtMs) && Number.isFinite(endsAtMs) && endsAtMs <= startsAtMs) {
      setError("End must be after start.");
      setSubmitting(false);
      return;
    }
    const categories = categoriesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 12);

    const r = createFest({
      clubId: null,
      name,
      description: description || undefined,
      startDate: startStr.slice(0, 10),
      endDate: endStr.slice(0, 10),
      creator: { email: user!.email, displayName: user!.displayName },
      eventType: "quiz",
      difficulty,
      source,
      questions: source === "custom" ? questions : undefined,
      privacy,
      categories,
      startsAtMs,
      endsAtMs,
      memberCap,
      rewards: templateById(rewardTemplate)?.tiers ?? [],
    });
    if (!r.ok) {
      setError(r.error);
      setSubmitting(false);
      return;
    }
    const { EV, track } = await import("@/lib/analytics");
    track(EV.quizLaunch, {
      festId: r.fest.id,
      privacy,
      memberCap,
      source,
      needsApproval: r.needsApproval,
    });
    setSubmitting(false);
    router.push(`/fests/${r.fest.id}`);
  }

  return (
    <>
      <div className="mb-2 text-xs">
        <Link href="/quizzes" className="text-ink-400 hover:text-ink-100">
          ← Quiz Floor
        </Link>
      </div>
      <h1 className="text-3xl font-semibold">Launch a Quiz Floor</h1>
      <p className="mt-2 text-sm text-ink-400">
        Private quizzes up to 100 participants go live instantly. Public
        quizzes — and private quizzes above 100 — are reviewed by an admin
        first.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <Section eyebrow="Basics" title="Name & privacy">
          <Field label="Quiz name">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Friday markets quiz"
              className="input"
            />
          </Field>
          <Field label="Pitch (optional)">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={140}
              placeholder="10 Qs on options + earnings"
              className="input"
            />
          </Field>
          <RadioRow
            label="Privacy"
            value={privacy}
            onChange={(v) => setPrivacy(v as FestPrivacy)}
            options={[
              {
                value: "private",
                label: "Private",
                blurb: "Invite-only via 6-char code.",
              },
              {
                value: "public",
                label: "Public",
                blurb: "Anyone with the code can join. Reviewed first.",
              },
            ]}
          />
        </Section>

        <Section eyebrow="Schedule" title="Run window">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Starts">
              <input
                type="datetime-local"
                required
                min={defaultDateTimeLocal(0)}
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Ends">
              <input
                type="datetime-local"
                required
                min={startStr || defaultDateTimeLocal(0)}
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                className="input"
              />
            </Field>
          </div>
        </Section>

        <Section eyebrow="Capacity" title="Participant cap">
          <Field label={`Up to ${memberCap} participants`}>
            <input
              type="range"
              min={2}
              max={1000}
              value={memberCap}
              onChange={(e) => setMemberCap(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-ink-500">
              <span>2</span>
              <span>100 (self-launch limit for private)</span>
              <span>1000</span>
            </div>
          </Field>
        </Section>

        <Section eyebrow="Content" title="Difficulty, categories & questions">
          <RadioRow
            label="Difficulty"
            value={difficulty}
            onChange={(v) => setDifficulty(v as FestDifficulty)}
            options={FEST_DIFFICULTIES.map((d) => ({
              value: d.id,
              label: d.label,
            }))}
          />
          <Field label="Categories / topics (comma-separated, up to 12)">
            <input
              type="text"
              value={categoriesInput}
              onChange={(e) => setCategoriesInput(e.target.value)}
              placeholder="options, earnings, technicals"
              className="input"
            />
          </Field>
          <RadioRow
            label="Question source"
            value={source}
            onChange={(v) => setSource(v as FestSource)}
            options={[
              {
                value: "system",
                label: "System-generated",
                blurb: "Pulled from our bank, tuned to difficulty.",
              },
              {
                value: "custom",
                label: "Custom",
                blurb: "Write your own. At least one required.",
              },
            ]}
          />

          {source === "custom" && (
            <div className="rounded-lg border border-ink-700 bg-ink-950 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  Custom questions ({questions.length})
                </span>
                <button
                  type="button"
                  onClick={addBlankQuestion}
                  className="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-200 hover:bg-ink-900"
                >
                  + Add question
                </button>
              </div>
              {questions.length === 0 && (
                <p className="mt-3 text-xs text-ink-500">
                  No questions yet. Add at least one to save.
                </p>
              )}
              <ul className="mt-3 space-y-3">
                {questions.map((q, i) => (
                  <li
                    key={q.id}
                    className="rounded-md border border-ink-800 bg-ink-900/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-ink-500">Q{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeQuestion(i)}
                        className="text-xs text-ink-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      value={q.prompt}
                      onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                      placeholder="Prompt"
                      className="input mt-2"
                    />
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={
                            "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs " +
                            (q.answer === oi
                              ? "border-brand-500 bg-brand-500/10"
                              : "border-ink-700 bg-ink-950")
                          }
                        >
                          <input
                            type="radio"
                            name={`ans-${q.id}`}
                            checked={q.answer === oi}
                            onChange={() => updateQuestion(i, { answer: oi })}
                            className="accent-emerald-500"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const next = [...q.options];
                              next[oi] = e.target.value;
                              updateQuestion(i, { options: next });
                            }}
                            placeholder={`Option ${oi + 1}`}
                            className="flex-1 bg-transparent outline-none"
                          />
                        </label>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section eyebrow="Prizes" title="Rewards (optional)">
          <div className="flex flex-col gap-2">
            {REWARD_TEMPLATES.map((t) => {
              const on = rewardTemplate === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRewardTemplate(t.id)}
                  className={
                    "rounded-lg border px-3 py-2.5 text-left text-xs transition " +
                    (on
                      ? "border-brand-500 bg-brand-500/10 text-ink-50"
                      : "border-ink-700 text-ink-300 hover:border-ink-500")
                  }
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="mt-0.5 text-[11px] text-ink-500">
                    {t.id === "none" ? t.blurb : tiersSummary(t.tiers)}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-[11px] text-ink-500">
            {COMPLIANCE_DISCLOSURE}
          </p>
        </Section>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div
          className={
            "rounded-xl border px-4 py-3 text-sm " +
            (willNeedApproval
              ? "border-amber-500/40 bg-amber-500/5 text-amber-200"
              : "border-brand-500/40 bg-brand-500/5 text-brand-200")
          }
        >
          {willNeedApproval ? (
            <>
              <strong>Admin approval required.</strong> Public quizzes — and
              private quizzes above 100 participants — are reviewed first.
              You&apos;ll see it as &quot;Pending&quot; until approved.
            </>
          ) : (
            <>
              <strong>Goes live instantly.</strong> Private quiz with a cap
              of 100 or fewer — no approval needed.
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link href="/quizzes" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting
              ? "Launching…"
              : willNeedApproval
                ? "Submit for approval"
                : "Launch Quiz Floor"}
          </button>
        </div>
      </form>
    </>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-lg font-semibold text-ink-50">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function RadioRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; blurb?: string }[];
}) {
  return (
    <div>
      <div className="mb-1.5 block text-xs font-medium text-ink-300">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={
                "rounded-md border px-3 py-2 text-left text-xs transition " +
                (on
                  ? "border-brand-500 bg-brand-500/10 text-ink-50"
                  : "border-ink-700 text-ink-300 hover:border-ink-500")
              }
            >
              <div className="font-medium">{o.label}</div>
              {o.blurb && (
                <div className="mt-0.5 text-[11px] text-ink-500">{o.blurb}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
