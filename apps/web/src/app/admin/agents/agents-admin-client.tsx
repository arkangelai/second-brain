"use client";

import * as React from "react";
import {
  Ban,
  Check,
  Clipboard,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  AgentScopesSchema,
  scopeTemplates,
  summarizeAgentScopes,
  type AgentScopes,
  type ScopeTemplateName,
} from "@second-brain/shared";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type RequestedRole = "owner" | "admin" | "member" | undefined;

type AgentSummary = {
  id: string;
  name: string;
  description: string;
  status: "active" | "revoked";
  scopes: AgentScopes;
  lastSeen: string | null;
  createdBy: string | null;
  createdAt: string;
};

type AgentsResponse = {
  agents: AgentSummary[];
  role: "owner" | "admin" | "member";
  canManage: boolean;
};

type CreatedKey = {
  agentName: string;
  plaintextKey: string;
};

const templateOptions: Array<{
  value: ScopeTemplateName;
  label: string;
  description: string;
}> = [
  { value: "reader", label: "Reader", description: "Search and retrieve only" },
  { value: "writer", label: "Writer", description: "Default write paths" },
  { value: "researcher", label: "Researcher", description: "Writer plus ingestion" },
  { value: "custom", label: "Custom", description: "Edit scope JSON" },
];

export function AgentsAdminClient({
  requestedRole,
}: {
  requestedRole: RequestedRole;
}) {
  const [agents, setAgents] = React.useState<AgentSummary[]>([]);
  const [role, setRole] = React.useState<AgentsResponse["role"]>("owner");
  const [canManage, setCanManage] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createdKey, setCreatedKey] = React.useState<CreatedKey | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const headers = React.useMemo(() => roleHeaders(requestedRole), [requestedRole]);

  const loadAgents = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/agents", {
        headers,
        cache: "no-store",
      });
      const payload = (await response.json()) as AgentsResponse | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to load agents.");
      }

      const data = payload as AgentsResponse;
      setAgents(data.agents);
      setRole(data.role);
      setCanManage(data.canManage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load agents.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  React.useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  async function revoke(agent: AgentSummary) {
    if (!canManage || agent.status === "revoked") return;

    const previousAgents = agents;
    setRevokingId(agent.id);
    setAgents((current) =>
      current.map((candidate) =>
        candidate.id === agent.id
          ? { ...candidate, status: "revoked" as const }
          : candidate
      )
    );

    try {
      const response = await fetch(`/api/admin/agents/${agent.id}/revoke`, {
        method: "POST",
        headers,
      });
      const payload = (await response.json()) as
        | { agent: AgentSummary }
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to revoke agent.");
      }

      const data = payload as { agent: AgentSummary };
      setAgents((current) =>
        current.map((candidate) =>
          candidate.id === agent.id ? data.agent : candidate
        )
      );
    } catch (revokeError) {
      setAgents(previousAgents);
      setError(
        revokeError instanceof Error ? revokeError.message : "Unable to revoke agent."
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <main className="relative text-stone-200">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <header className="motion-safe:animate-[reveal-up_700ms_cubic-bezier(0.22,1,0.36,1)_both] flex flex-col gap-6 border-b border-stone-800/70 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.3em] text-teal-200/80">
              <ShieldCheck className="size-3.5" aria-hidden />
              Vault administration / agent registry
            </span>
            <h1
              className="font-[family-name:var(--font-fraunces)] text-[clamp(2.25rem,4vw,3.5rem)] font-light leading-[1.02] text-stone-100"
              style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 30" }}
            >
              Agent{" "}
              <em className="font-normal italic text-amber-200/95">
                registry
              </em>
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-400">
              Register AI agents, assign vault scopes, reveal the one-time key,
              and revoke compromised credentials.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge tone={canManage ? "green" : "amber"}>
              {roleLabel(role)}
            </StatusBadge>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void loadAgents()}
              title="Refresh agents"
              aria-label="Refresh agents"
              className="border-stone-700/80 bg-stone-950/60 text-stone-200 hover:border-amber-200/60 hover:bg-stone-900 hover:text-amber-100"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <section className="motion-safe:animate-[reveal-up_700ms_120ms_cubic-bezier(0.22,1,0.36,1)_both] min-w-0 space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-2">
                <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
                  Card / 0401 — registry
                </span>
                <h2
                  className="font-[family-name:var(--font-fraunces)] text-[1.6rem] leading-tight text-stone-100"
                  style={{ fontVariationSettings: "'opsz' 48" }}
                >
                  Registered agents
                </h2>
                <p className="text-sm text-stone-400">
                  {agents.length}{" "}
                  {agents.length === 1 ? "agent" : "agents"} in this vault
                </p>
              </div>
            </div>
            <AgentsTable
              agents={agents}
              loading={loading}
              canManage={canManage}
              revokingId={revokingId}
              onRevoke={revoke}
            />
          </section>

          <section className="motion-safe:animate-[reveal-up_700ms_220ms_cubic-bezier(0.22,1,0.36,1)_both] space-y-5">
            <div className="space-y-2">
              <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-amber-200/80">
                Card / 0402 — issue key
              </span>
              <h2
                className="font-[family-name:var(--font-fraunces)] text-[1.6rem] leading-tight text-stone-100"
                style={{ fontVariationSettings: "'opsz' 48" }}
              >
                Create agent
              </h2>
              <p className="text-sm text-stone-400">
                {canManage
                  ? "New keys are revealed once — copy on the spot."
                  : "Members have read-only access."}
              </p>
            </div>
            <CreateAgentForm
              canManage={canManage}
              headers={headers}
              onCreated={(agent, plaintextKey) => {
                setAgents((current) => [agent, ...current]);
                setCreatedKey({ agentName: agent.name, plaintextKey });
              }}
              onError={setError}
            />
          </section>
        </div>
      </div>

      {createdKey ? (
        <KeyRevealDialog
          createdKey={createdKey}
          onDone={() => setCreatedKey(null)}
        />
      ) : null}
    </main>
  );
}

function AgentsTable({
  agents,
  loading,
  canManage,
  revokingId,
  onRevoke,
}: {
  agents: AgentSummary[];
  loading: boolean;
  canManage: boolean;
  revokingId: string | null;
  onRevoke: (agent: AgentSummary) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-stone-800/80 bg-stone-950/40 backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-stone-950/70 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.24em] text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Scopes</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
              <th className="px-4 py-3 font-medium">Created by</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/70">
            {loading ? (
              <tr>
                <td
                  className="px-4 py-10 text-center font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-500"
                  colSpan={6}
                >
                  <Loader2 className="mx-auto mb-3 size-4 animate-spin text-teal-300/80" />
                  Loading agents
                </td>
              </tr>
            ) : null}
            {!loading && agents.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-sm text-stone-500"
                  colSpan={6}
                >
                  <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-600">
                    Empty registry
                  </span>
                  <p className="mt-2 font-[family-name:var(--font-fraunces)] text-lg italic text-stone-300">
                    No agents registered yet.
                  </p>
                </td>
              </tr>
            ) : null}
            {agents.map((agent) => (
              <tr
                key={agent.id}
                className="bg-transparent align-top transition-colors hover:bg-stone-900/40"
              >
                <td className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-stone-800/80 bg-stone-950 font-[family-name:var(--font-fraunces)] text-sm text-teal-200/90">
                      {agent.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <div className="font-[family-name:var(--font-fraunces)] text-base leading-tight text-stone-100">
                        {agent.name}
                      </div>
                      {agent.description ? (
                        <div className="mt-1 max-w-64 text-xs leading-relaxed text-stone-500">
                          {agent.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge
                    tone={agent.status === "active" ? "green" : "red"}
                  >
                    {agent.status === "active" ? "Active" : "Revoked"}
                  </StatusBadge>
                </td>
                <td className="px-4 py-4">
                  <div className="max-w-80 font-[family-name:var(--font-plex-mono)] text-xs leading-relaxed text-stone-400">
                    {summarizeAgentScopes(agent.scopes)}
                  </div>
                </td>
                <td className="px-4 py-4 text-stone-400">
                  {formatDate(agent.lastSeen)}
                </td>
                <td className="px-4 py-4 font-[family-name:var(--font-plex-mono)] text-xs text-stone-500">
                  {agent.createdBy ? shortId(agent.createdBy) : "system"}
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={
                        !canManage ||
                        agent.status === "revoked" ||
                        revokingId === agent.id
                      }
                      onClick={() => onRevoke(agent)}
                      title="Revoke agent"
                      aria-label={`Revoke ${agent.name}`}
                      className="text-stone-400 hover:bg-red-500/15 hover:text-red-200"
                    >
                      {revokingId === agent.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Ban className="size-4" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateAgentForm({
  canManage,
  headers,
  onCreated,
  onError,
}: {
  canManage: boolean;
  headers: HeadersInit;
  onCreated: (agent: AgentSummary, plaintextKey: string) => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [template, setTemplate] = React.useState<ScopeTemplateName>("writer");
  const [scopeJson, setScopeJson] = React.useState(formatScopes(scopeTemplates.writer));
  const [scopeError, setScopeError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function updateTemplate(nextTemplate: ScopeTemplateName) {
    setTemplate(nextTemplate);
    setScopeJson(formatScopes(scopeTemplates[nextTemplate]));
    setScopeError(null);
  }

  function parseScopes(): AgentScopes | null {
    try {
      const parsedJson = JSON.parse(scopeJson);
      const parsedScopes = AgentScopesSchema.safeParse(parsedJson);

      if (!parsedScopes.success) {
        setScopeError(parsedScopes.error.issues[0]?.message ?? "Invalid scope JSON.");
        return null;
      }

      setScopeError(null);
      return parsedScopes.data;
    } catch {
      setScopeError("Scope JSON must be valid JSON.");
      return null;
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError(null);

    const scopes = parseScopes();
    if (!scopes) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ name, description, scopes }),
      });
      const payload = (await response.json()) as
        | { agent: AgentSummary; plaintext_key: string }
        | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to create agent.");
      }

      const data = payload as { agent: AgentSummary; plaintext_key: string };
      onCreated(data.agent, data.plaintext_key);
      setName("");
      setDescription("");
      updateTemplate("writer");
    } catch (createError) {
      onError(
        createError instanceof Error ? createError.message : "Unable to create agent."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-5 rounded-md border border-stone-800/80 bg-stone-950/60 p-5 backdrop-blur"
      onSubmit={submit}
    >
      <fieldset disabled={!canManage || submitting} className="space-y-5">
        <FormField id="agent-name" label="Name">
          <input
            id="agent-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            required
            className="h-11 w-full rounded-md border border-stone-800/80 bg-stone-950/70 px-3 font-[family-name:var(--font-plex-mono)] text-sm text-stone-100 placeholder:text-stone-600 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
            placeholder="claudio"
          />
        </FormField>

        <FormField id="agent-description" label="Description">
          <textarea
            id="agent-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-24 w-full resize-y rounded-md border border-stone-800/80 bg-stone-950/70 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
            placeholder="Writes daily research notes"
          />
        </FormField>

        <FormField id="agent-template" label="Scope template">
          <select
            id="agent-template"
            value={template}
            onChange={(event) =>
              updateTemplate(event.target.value as ScopeTemplateName)
            }
            className="h-11 w-full rounded-md border border-stone-800/80 bg-stone-950/70 px-3 text-sm text-stone-100 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
          >
            {templateOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-stone-950"
              >
                {option.label} — {option.description}
              </option>
            ))}
          </select>
        </FormField>

        {template === "custom" ? (
          <details
            open
            className="rounded-md border border-stone-800/80 bg-stone-950/50 p-3"
          >
            <summary className="cursor-pointer font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-400">
              Scope JSON
            </summary>
            <textarea
              value={scopeJson}
              onChange={(event) => setScopeJson(event.target.value)}
              spellCheck={false}
              className="mt-3 min-h-72 w-full resize-y rounded-md border border-stone-800/80 bg-stone-950/80 p-3 font-mono text-xs leading-5 text-stone-100 outline-none transition focus:border-amber-200/70 focus:ring-1 focus:ring-amber-200/30"
            />
            {scopeError ? (
              <p className="mt-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {scopeError}
              </p>
            ) : null}
          </details>
        ) : null}

        {template !== "custom" ? (
          <div className="rounded-md border border-stone-800/80 bg-stone-950/40 p-3 font-[family-name:var(--font-plex-mono)] text-xs leading-relaxed text-stone-400">
            {summarizeAgentScopes(scopeTemplates[template])}
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-11 w-full bg-amber-200 text-stone-950 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_18px_50px_-20px_rgba(252,211,77,0.55)] hover:bg-amber-100"
          disabled={!canManage || submitting}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Create agent
        </Button>
      </fieldset>
    </form>
  );
}

function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-400"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function KeyRevealDialog({
  createdKey,
  onDone,
}: {
  createdKey: CreatedKey;
  onDone: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  async function copyKey() {
    await navigator.clipboard.writeText(createdKey.plaintextKey);
    setCopied(true);
  }

  function done() {
    setOpen(false);
    onDone();
  }

  return (
    <Dialog
      defaultOpen={!!createdKey}
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(nextOpen);
      }}
    >
      <DialogContent
        showClose={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        className="border-stone-800/80 bg-stone-950 text-stone-200"
      >
        <DialogHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-md border border-amber-300/30 bg-amber-300/10 text-amber-200">
            <KeyRound className="size-5" />
          </div>
          <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-amber-200/85">
            Reveal one time / record now
          </span>
          <DialogTitle
            className="font-[family-name:var(--font-fraunces)] text-2xl text-stone-100"
            style={{ fontVariationSettings: "'opsz' 48" }}
          >
            {createdKey.agentName} API key
          </DialogTitle>
          <DialogDescription className="text-stone-400">
            You will not see this again. Copy it now and store it in the agent
            environment.
          </DialogDescription>
        </DialogHeader>

        <div className="relative rounded-md border border-stone-800/80 bg-stone-950/80 p-4">
          <span className="absolute -top-2 left-3 inline-flex bg-stone-950 px-1 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
            plaintext / once
          </span>
          <code className="block break-all font-mono text-xs leading-relaxed text-stone-100">
            {createdKey.plaintextKey}
          </code>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-stone-700/80 bg-stone-950/60 text-stone-200 hover:border-amber-200/60 hover:bg-stone-900 hover:text-amber-100"
            onClick={copyKey}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy key"}
          </Button>
          <Button
            type="button"
            className="flex-1 bg-amber-200 text-stone-950 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_18px_50px_-20px_rgba(252,211,77,0.55)] hover:bg-amber-100"
            onClick={done}
          >
            <Clipboard className="size-4" />
            I&apos;ve copied it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-md border px-2.5 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.22em]",
        tone === "green" &&
          "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
        tone === "amber" &&
          "border-amber-400/30 bg-amber-500/10 text-amber-200",
        tone === "red" && "border-red-400/30 bg-red-500/10 text-red-200"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "green" && "bg-emerald-300/90",
          tone === "amber" && "bg-amber-300/90",
          tone === "red" && "bg-red-300/90"
        )}
      />
      {children}
    </span>
  );
}

function roleHeaders(role: RequestedRole): HeadersInit {
  return role ? { "x-second-brain-role": role } : {};
}

function roleLabel(role: AgentsResponse["role"]): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member read-only";
}

function formatScopes(scopes: AgentScopes): string {
  return JSON.stringify(scopes, null, 2);
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function shortId(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
