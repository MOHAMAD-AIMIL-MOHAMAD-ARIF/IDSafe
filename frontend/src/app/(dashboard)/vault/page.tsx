"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthContext } from "@/components/auth/auth-provider";
import { usePasswordGenerator } from "@/hooks/use-password-generator";
import { useVaultEntries } from "@/hooks/use-vault-entries";
import { routes } from "@/lib/config/routes";
import type { VaultEntryForm, VaultEntryView } from "@/types/vault";
import type { PasswordGeneratorOptions } from "@/hooks/use-password-generator";

const emptyEntry: VaultEntryForm = {
  title: "",
  username: "",
  password: "",
  url: "",
  notes: "",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

// If PasswordGeneratorOptions also has non-boolean keys (like "length"),
// keep this list restricted to the boolean toggle keys.
type PasswordToggleKey = Extract<
  keyof PasswordGeneratorOptions,
  "includeLowercase" | "includeUppercase" | "includeDigits" | "includeSymbols"
>;

const PASSWORD_TOGGLE_OPTIONS = [
  { key: "includeLowercase", label: "Lowercase (a-z)" },
  { key: "includeUppercase", label: "Uppercase (A-Z)" },
  { key: "includeDigits", label: "Digits (0-9)" },
  { key: "includeSymbols", label: "Symbols (!@#)" },
] as const satisfies ReadonlyArray<{ key: PasswordToggleKey; label: string }>;

export default function VaultPage() {
  const { status, logout } = useAuthContext();
  const {
    entries,
    status: vaultStatus,
    errorMessage,
    warningMessage,
    loadEntries,
    createEntry,
    updateEntry,
    deleteEntry,
  } = useVaultEntries();
  const generator = usePasswordGenerator();
  const [search, setSearch] = useState("");
  const [activeEntryId, setActiveEntryId] = useState<number | null>(null);
  const [formState, setFormState] = useState<VaultEntryForm>(emptyEntry);
  const [formStatus, setFormStatus] = useState<"idle" | "saving">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [clipboardMessage, setClipboardMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!activeEntryId) {
      setFormState(emptyEntry);
      return;
    }
    const entry = entries.find((item) => item.entryId === activeEntryId);
    if (entry) {
      setFormState({
        title: entry.title,
        username: entry.username,
        password: entry.password,
        url: entry.url,
        notes: entry.notes ?? "",
      });
    }
  }, [activeEntryId, entries]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((entry) => {
      return [entry.title, entry.username, entry.url, entry.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [entries, search]);

  const activeEntry: VaultEntryView | null = useMemo(() => {
    if (!activeEntryId) return null;
    return entries.find((entry) => entry.entryId === activeEntryId) ?? null;
  }, [activeEntryId, entries]);

  const resetForm = () => {
    setActiveEntryId(null);
    setFormState(emptyEntry);
    setFormError(null);
  };

  const handleSubmit = async () => {
    setFormError(null);
    setClipboardMessage(null);
    if (!formState.title.trim()) {
      setFormError("Add a title to help you identify this entry.");
      return;
    }

    setFormStatus("saving");
    try {
      if (activeEntryId) {
        const updated = await updateEntry(activeEntryId, formState);
        setActiveEntryId(updated.entryId);
      } else {
        const created = await createEntry(formState);
        setActiveEntryId(created.entryId);
      }
      setFormStatus("idle");
    } catch (error) {
      setFormStatus("idle");
      setFormError(error instanceof Error ? error.message : "Unable to save entry.");
    }
  };

  const handleDelete = async (entryId: number) => {
    setClipboardMessage(null);
    const confirmed = window.confirm("Move this entry to the vault trash?");
    if (!confirmed) return;
    try {
      await deleteEntry(entryId);
      if (activeEntryId === entryId) resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete entry.");
    }
  };

  const handleCopy = async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setClipboardMessage(`${label} copied to clipboard.`);
    } catch {
      setClipboardMessage(`Unable to copy ${label}. Check browser permissions.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">
              Vault dashboard
            </p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Your encrypted vault</h1>
            <p className="mt-2 text-sm text-slate-600">
              Entries are decrypted locally on this device and never leave your browser in
              plaintext.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadEntries()}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              Refresh entries
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </header>

        {status === "unauthenticated" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
            Your session has expired. Sign in again to unlock the vault.
            <div className="mt-3">
              <Link className="font-semibold text-amber-900" href={routes.login}>
                Return to login
              </Link>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {warningMessage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
            {warningMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Vault entries</h2>
                  <p className="text-sm text-slate-500">
                    {entries.length} stored • {filteredEntries.length} visible
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90"
                >
                  New entry
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Search locally
                  </label>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by title, username, or URL"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  Search is performed on-device only.
                </div>
              </div>
            </div>

            {vaultStatus === "loading" && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                Unlocking and decrypting your entries...
              </div>
            )}

            {vaultStatus === "ready" && filteredEntries.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
                No entries match your search yet. Add a new vault item to get started.
              </div>
            )}

            <div className="grid gap-4">
              {filteredEntries.map((entry) => (
                <article
                  key={entry.entryId}
                  className={`rounded-3xl border bg-white p-5 shadow-sm transition ${
                    entry.entryId === activeEntryId
                      ? "border-brand/60 ring-2 ring-brand/20"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{entry.title}</h3>
                      <p className="text-sm text-slate-500">{entry.username || "No username"}</p>
                      {entry.url && (
                        <a
                          href={entry.url}
                          className="mt-1 block text-xs font-semibold text-brand hover:text-brand/80"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {entry.url}
                        </a>
                      )}
                      <p className="mt-2 text-xs text-slate-400">
                        Updated {formatDate(entry.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveEntryId(entry.entryId)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        {entry.entryId === activeEntryId ? "Editing" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopy("Username", entry.username)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Copy user
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopy("Password", entry.password)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Copy password
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(entry.entryId)}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:border-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {activeEntry ? "Edit entry" : "Create entry"}
                </h2>
                {activeEntry && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Title
                  </label>
                  <input
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, title: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="e.g. Personal email"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Username
                  </label>
                  <input
                    value={formState.username}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, username: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Password
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={formState.password}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, password: event.target.value }))
                      }
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      placeholder="Generate a strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy("Password", formState.password)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      Copy password
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          password: generator.generatedPassword,
                        }))
                      }
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      Use generated
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    URL
                  </label>
                  <input
                    value={formState.url}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, url: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="https://"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notes
                  </label>
                  <textarea
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="Add any extra context"
                  />
                </div>
              </div>

              {formError && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </p>
              )}

              {clipboardMessage && (
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {clipboardMessage}
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={formStatus === "saving"}
                className="mt-5 w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {formStatus === "saving"
                  ? "Saving entry..."
                  : activeEntry
                    ? "Save changes"
                    : "Add to vault"}
              </button>

              {activeEntry && (
                <p className="mt-3 text-xs text-slate-500">
                  Created {formatDate(activeEntry.createdAt)} • Last updated {formatDate(activeEntry.updatedAt)}
                </p>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Password generator</h2>
              <p className="mt-2 text-sm text-slate-500">
                Generate strong, unique passwords without leaving your device.
              </p>
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Length
                  </label>
                  <input
                    type="number"
                    min={8}
                    max={64}
                    value={generator.options.length}
                    onChange={(event) =>
                      generator.setOptions((prev) => ({
                        ...prev,
                        length: Number(event.target.value) || 12,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-2 text-sm text-slate-600">
                  {PASSWORD_TOGGLE_OPTIONS.map((option) => (
                    <label key={option.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={generator.options[option.key]}
                        onChange={(event) => {
                          const key = option.key;
                          generator.setOptions((prev) => ({
                            ...prev,
                            [key]: event.target.checked,
                          }));
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={generator.generate}
                  className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm"
                >
                  Generate password
                </button>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {generator.generatedPassword || "Generate a password to preview it here."}
                </div>
                {generator.error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {generator.error}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy("Generated password", generator.generatedPassword)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        password: generator.generatedPassword,
                      }))
                    }
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                  >
                    Use in form
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
