"use client";

import * as React from "react";
import Link from "next/link";
import {
  Ban,
  Check,
  Clipboard,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
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
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-400" />
              <span>Admin</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Agent Registry
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Register AI agents, assign vault scopes, reveal the one-time key,
              and revoke compromised credentials.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <section className="min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium">Agents</h2>
                <p className="text-sm text-muted-foreground">
                  {agents.length} registered
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

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-medium">Create Agent</h2>
              <p className="text-sm text-muted-foreground">
                {canManage ? "New keys are revealed once." : "Members have read-only access."}
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
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Scopes</th>
              <th className="px-4 py-3 font-medium">Last Seen</th>
              <th className="px-4 py-3 font-medium">Created By</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                  Loading agents
                </td>
              </tr>
            ) : null}
            {!loading && agents.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No agents registered
                </td>
              </tr>
            ) : null}
            {agents.map((agent) => (
              <tr key={agent.id} className="bg-background align-top">
                <td className="px-4 py-4">
                  <div className="font-medium">{agent.name}</div>
                  {agent.description ? (
                    <div className="mt-1 max-w-64 text-xs text-muted-foreground">
                      {agent.description}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge tone={agent.status === "active" ? "green" : "red"}>
                    {agent.status === "active" ? "Active" : "Revoked"}
                  </StatusBadge>
                </td>
                <td className="px-4 py-4">
                  <div className="max-w-80 text-muted-foreground">
                    {summarizeAgentScopes(agent.scopes)}
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground">
                  {formatDate(agent.lastSeen)}
                </td>
                <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                  {agent.createdBy ? shortId(agent.createdBy) : "system"}
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="icon" title="View logs">
                      <Link
                        href={`/admin/audit?agent=${agent.id}`}
                        aria-label={`View logs for ${agent.name}`}
                      >
                        <ScrollText className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      disabled={
                        !canManage ||
                        agent.status === "revoked" ||
                        revokingId === agent.id
                      }
                      onClick={() => onRevoke(agent)}
                      title="Revoke agent"
                      aria-label={`Revoke ${agent.name}`}
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
      const parsedJson = JSON.parse(scopeJson) as unknown;
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
      className="space-y-5 rounded-lg border border-border bg-card/40 p-4"
      onSubmit={submit}
    >
      <fieldset disabled={!canManage || submitting} className="space-y-5">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-1 focus:ring-ring"
            placeholder="claudio"
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-20 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-1 focus:ring-ring"
            placeholder="Writes daily research notes"
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Scope Template</span>
          <select
            value={template}
            onChange={(event) =>
              updateTemplate(event.target.value as ScopeTemplateName)
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-1 focus:ring-ring"
          >
            {templateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.description}
              </option>
            ))}
          </select>
        </label>

        {template === "custom" ? (
          <details open className="rounded-md border border-border bg-background/60 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Scope JSON
            </summary>
            <textarea
              value={scopeJson}
              onChange={(event) => setScopeJson(event.target.value)}
              spellCheck={false}
              className="mt-3 min-h-72 w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs leading-5 outline-none transition focus:border-ring focus:ring-1 focus:ring-ring"
            />
            {scopeError ? (
              <p className="mt-2 text-sm text-destructive-foreground">
                {scopeError}
              </p>
            ) : null}
          </details>
        ) : null}

        {template !== "custom" ? (
          <div className="rounded-md border border-border bg-background/60 p-3 text-xs leading-5 text-muted-foreground">
            {summarizeAgentScopes(scopeTemplates[template])}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={!canManage || submitting}>
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
      >
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
            <KeyRound className="size-5" />
          </div>
          <DialogTitle>{createdKey.agentName} API key</DialogTitle>
          <DialogDescription>
            You will not see this again.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-background p-3">
          <code className="block break-all font-mono text-xs leading-5">
            {createdKey.plaintextKey}
          </code>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="flex-1" onClick={copyKey}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy key"}
          </Button>
          <Button type="button" className="flex-1" onClick={done}>
            <Clipboard className="size-4" />
            I've copied it
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
        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium",
        tone === "green" &&
          "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
        tone === "amber" &&
          "border-amber-400/30 bg-amber-500/10 text-amber-200",
        tone === "red" && "border-red-400/30 bg-red-500/10 text-red-300"
      )}
    >
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
