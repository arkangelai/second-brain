"use client";

import * as React from "react";
import { Copy, Loader2, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  cancelInvitationAction,
  createInvitationAction,
  removeMemberAction,
  renameTeamAction,
  updateMemberRoleAction,
  type ActionResult,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TEAM_ROLES,
  type AdminTeamPageData,
  type PendingInvitation,
  type TeamMember,
  type TeamRole,
} from "@/lib/admin/team-types";

type MembersUpdate =
  | { type: "role"; userId: string; role: TeamRole }
  | { type: "remove"; userId: string };

type InvitationsUpdate =
  | { type: "add"; invitation: PendingInvitation }
  | { type: "remove"; invitationId: string }
  | { type: "replace"; invitation: PendingInvitation };

export function TeamAdminClient({
  data,
  inviteAccepted = false,
}: {
  data: AdminTeamPageData;
  inviteAccepted?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [teamName, setTeamName] = React.useOptimistic(
    data.team.name,
    (_current, next: string) => next
  );
  const [members, updateMembers] = React.useOptimistic(
    data.members,
    (current, update: MembersUpdate) => {
      if (update.type === "remove") {
        return current.filter((member) => member.userId !== update.userId);
      }

      return current.map((member) =>
        member.userId === update.userId
          ? { ...member, role: update.role }
          : member
      );
    }
  );
  const [invitations, updateInvitations] = React.useOptimistic(
    data.invitations,
    (current, update: InvitationsUpdate) => {
      if (update.type === "remove") {
        return current.filter((invite) => invite.id !== update.invitationId);
      }
      if (update.type === "replace") {
        return current.map((invite) =>
          invite.id === update.invitation.id ? update.invitation : invite
        );
      }

      return [update.invitation, ...current];
    }
  );

  const ownerCount = members.filter((member) => member.role === "owner").length;

  React.useEffect(() => {
    if (inviteAccepted) {
      toast.success("Invitation accepted.");
    }
  }, [inviteAccepted]);

  function refreshAfter(result: ActionResult, successMessage?: string) {
    if (result.ok) {
      toast.success(successMessage ?? result.message);
    } else {
      toast.error(result.message);
    }
    router.refresh();
  }

  function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextName = String(formData.get("name") ?? "").trim();

    startTransition(async () => {
      setTeamName(nextName);
      const result = await renameTeamAction(formData);
      refreshAfter(result);
    });
  }

  function submitRole(userId: string, role: TeamRole) {
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("role", role);

    startTransition(async () => {
      updateMembers({ type: "role", userId, role });
      const result = await updateMemberRoleAction(formData);
      refreshAfter(result);
    });
  }

  function submitRemove(userId: string) {
    const formData = new FormData();
    formData.set("userId", userId);

    startTransition(async () => {
      updateMembers({ type: "remove", userId });
      const result = await removeMemberAction(formData);
      refreshAfter(result);
    });
  }

  function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = teamRoleFromValue(formData.get("role"));

    if (!email || !role) {
      toast.error("Enter an email and choose a role.");
      return;
    }

    const optimisticInvite: PendingInvitation = {
      id: `pending-${Date.now()}`,
      email,
      role,
      invitedAt: new Date().toISOString(),
      expiresAt: addDays(new Date(), 7).toISOString(),
    };

    startTransition(async () => {
      updateInvitations({ type: "add", invitation: optimisticInvite });
      const result = await createInvitationAction(formData);

      if (result.ok) {
        form.reset();
        await copyToClipboard(result.data.link);
        toast.success("Invitation created and link copied.");
      } else {
        toast.error(result.message);
      }

      router.refresh();
    });
  }

  function submitCancelInvitation(invitationId: string) {
    const formData = new FormData();
    formData.set("invitationId", invitationId);

    startTransition(async () => {
      updateInvitations({ type: "remove", invitationId });
      const result = await cancelInvitationAction(formData);
      refreshAfter(result);
    });
  }

  function copyInvitationLink(invitationId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/invitations/${invitationId}`, {
          method: "POST",
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? "Could not regenerate invitation link.");
        }

        updateInvitations({ type: "replace", invitation: body.invitation });
        await copyToClipboard(body.link);
        toast.success("Invitation link copied.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not copy link.");
      }
    });
  }

  return (
    <main className="relative">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <header className="motion-safe:animate-[reveal-up_700ms_cubic-bezier(0.22,1,0.36,1)_both] flex flex-col gap-6 border-b border-stone-800/70 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.3em] text-teal-200/80">
              <span className="size-1.5 rounded-full bg-teal-300/80" />
              Vault administration / 01
            </span>
            <div className="flex flex-wrap items-end gap-4">
              <h1
                className="font-[family-name:var(--font-fraunces)] text-[clamp(2.25rem,4vw,3.5rem)] font-light leading-[1.02] text-stone-100"
                style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 30" }}
              >
                {teamName}
              </h1>
              <Badge
                variant="outline"
                className="border-teal-300/30 bg-teal-300/10 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.22em] text-teal-100"
              >
                {roleLabel(data.currentUser.role)}
              </Badge>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-stone-400">
              Manage team settings, human members, and active invitations.
              Changes propagate to every device using this archive.
            </p>
          </div>
          <div className="flex flex-col gap-2 self-end rounded-md border border-stone-800/80 bg-stone-950/60 px-4 py-3 text-right">
            <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
              Slug
            </span>
            <span className="font-[family-name:var(--font-plex-mono)] text-sm text-stone-100">
              {data.team.slug}
            </span>
          </div>
        </header>

        <section className="motion-safe:animate-[reveal-up_700ms_120ms_cubic-bezier(0.22,1,0.36,1)_both] grid gap-6 rounded-md border border-stone-800/80 bg-stone-950/60 p-5 backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)] md:p-7">
          <div className="space-y-3">
            <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
              Card / 0301 — settings
            </span>
            <h2
              className="font-[family-name:var(--font-fraunces)] text-[1.6rem] leading-tight text-stone-100"
              style={{ fontVariationSettings: "'opsz' 48" }}
            >
              Team settings
            </h2>
            <p className="text-sm leading-relaxed text-stone-400">
              Rename the team and review the immutable identifiers your agents
              and members reference.
            </p>
          </div>

          <div className="space-y-6">
            <form className="space-y-2" onSubmit={submitRename}>
              <Label
                htmlFor="team-name"
                className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-400"
              >
                Team name
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="team-name"
                  name="name"
                  defaultValue={data.team.name}
                  minLength={2}
                  maxLength={80}
                  disabled={!data.permissions.canRenameTeam || isPending}
                  required
                  className="h-11 border-stone-800/80 bg-stone-950/70 text-stone-100 placeholder:text-stone-600 focus-visible:border-amber-200/70 focus-visible:ring-amber-200/30"
                />
                <Button
                  type="submit"
                  disabled={!data.permissions.canRenameTeam || isPending}
                  className="h-11 bg-amber-200 text-stone-950 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_18px_50px_-20px_rgba(252,211,77,0.45)] hover:bg-amber-100"
                >
                  {isPending ? <Loader2 className="animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </form>

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-md border border-stone-800/80 bg-stone-950/40 p-3">
                <dt className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
                  Slug
                </dt>
                <dd className="mt-1 font-[family-name:var(--font-plex-mono)] text-stone-100">
                  {data.team.slug}
                </dd>
              </div>
              <div className="rounded-md border border-stone-800/80 bg-stone-950/40 p-3">
                <dt className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
                  Created
                </dt>
                <dd className="mt-1 text-stone-100">
                  {formatDate(data.team.createdAt)}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="motion-safe:animate-[reveal-up_700ms_180ms_cubic-bezier(0.22,1,0.36,1)_both] space-y-5 rounded-md border border-stone-800/80 bg-stone-950/60 p-5 backdrop-blur md:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
                Card / 0302 — members
              </span>
              <h2
                className="font-[family-name:var(--font-fraunces)] text-[1.6rem] leading-tight text-stone-100"
                style={{ fontVariationSettings: "'opsz' 48" }}
              >
                Members
              </h2>
              <p className="text-sm text-stone-400">
                Human team members and their current access.
              </p>
            </div>
            <Badge
              variant="outline"
              className="self-start border-stone-700 bg-stone-950/60 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.24em] text-stone-300 sm:self-end"
            >
              {members.length} total
            </Badge>
          </div>

          <Table aria-label="Team members">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[6rem] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody onKeyDown={focusAdjacentRow}>
              {members.map((member) => (
                <TableRow key={member.userId} data-roving-row tabIndex={0}>
                  <TableCell>
                    <div className="flex min-w-48 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
                        {initials(member.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{member.name}</div>
                        {member.isCurrentUser ? (
                          <div className="text-xs text-muted-foreground">You</div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-56 text-muted-foreground">
                    {member.email}
                  </TableCell>
                  <TableCell className="min-w-40">
                    {data.permissions.canManageMembers ? (
                      <RoleSelect
                        member={member}
                        ownerCount={ownerCount}
                        disabled={isPending}
                        onChange={submitRole}
                      />
                    ) : (
                      <Badge variant="secondary">{roleLabel(member.role)}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="min-w-36 text-muted-foreground">
                    {formatDate(member.joinedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {data.permissions.canManageMembers ? (
                      <RemoveMemberDialog
                        member={member}
                        ownerCount={ownerCount}
                        disabled={isPending}
                        onConfirm={submitRemove}
                      />
                    ) : (
                      <Button variant="ghost" size="icon" disabled aria-label="No actions">
                        <MoreHorizontal />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="motion-safe:animate-[reveal-up_700ms_240ms_cubic-bezier(0.22,1,0.36,1)_both] grid gap-6 rounded-md border border-stone-800/80 bg-stone-950/60 p-5 backdrop-blur lg:grid-cols-[minmax(0,1fr)_24rem] md:p-7">
          <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-stone-500">
                  Card / 0303 — invitations
                </span>
                <h2
                  className="font-[family-name:var(--font-fraunces)] text-[1.6rem] leading-tight text-stone-100"
                  style={{ fontVariationSettings: "'opsz' 48" }}
                >
                  Pending invitations
                </h2>
                <p className="text-sm text-stone-400">
                  Open invites that have not been accepted.
                </p>
              </div>
              <Badge
                variant="outline"
                className="self-start border-stone-700 bg-stone-950/60 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.24em] text-stone-300 sm:self-end"
              >
                {invitations.length} pending
              </Badge>
            </div>

            <Table aria-label="Pending invitations">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[7rem] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody onKeyDown={focusAdjacentRow}>
                {invitations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No pending invitations.
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((invitation) => (
                    <TableRow key={invitation.id} data-roving-row tabIndex={0}>
                      <TableCell className="min-w-56 font-medium">
                        {invitation.email}
                      </TableCell>
                      <TableCell className="min-w-32">
                        <Badge variant="secondary">{roleLabel(invitation.role)}</Badge>
                      </TableCell>
                      <TableCell className="min-w-36 text-muted-foreground">
                        {formatDate(invitation.invitedAt)}
                      </TableCell>
                      <TableCell className="min-w-36 text-muted-foreground">
                        {formatDate(invitation.expiresAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Copy invite link for ${invitation.email}`}
                            disabled={
                              !data.permissions.canManageInvitations ||
                              isPending ||
                              invitation.id.startsWith("pending-")
                            }
                            onClick={() => copyInvitationLink(invitation.id)}
                          >
                            <Copy />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Cancel invite for ${invitation.email}`}
                            disabled={
                              !data.permissions.canManageInvitations ||
                              isPending ||
                              invitation.id.startsWith("pending-")
                            }
                            onClick={() => submitCancelInvitation(invitation.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data.permissions.canManageInvitations ? (
            <form
              className="space-y-5 rounded-md border border-stone-800/80 bg-stone-950/40 p-5"
              onSubmit={submitInvite}
            >
              <div className="space-y-2">
                <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.28em] text-amber-200/80">
                  Issue invitation
                </span>
                <h3 className="font-[family-name:var(--font-fraunces)] text-xl leading-tight text-stone-100">
                  Invite member
                </h3>
                <p className="text-sm leading-relaxed text-stone-400">
                  Send an expiring invite link to a human teammate. The link is
                  copied to your clipboard on creation.
                </p>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="invite-email"
                  className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-400"
                >
                  Email
                </Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                  className="h-11 border-stone-800/80 bg-stone-950/70 text-stone-100 placeholder:text-stone-600 focus-visible:border-amber-200/70 focus-visible:ring-amber-200/30"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="invite-role"
                  className="font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.28em] text-stone-400"
                >
                  Role
                </Label>
                <InviteRoleSelect />
              </div>
              <Button
                type="submit"
                className="h-11 w-full bg-amber-200 text-stone-950 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_18px_50px_-20px_rgba(252,211,77,0.55)] hover:bg-amber-100"
                disabled={isPending}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Send invite
              </Button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function RoleSelect({
  member,
  ownerCount,
  disabled,
  onChange,
}: {
  member: TeamMember;
  ownerCount: number;
  disabled: boolean;
  onChange: (userId: string, role: TeamRole) => void;
}) {
  const cannotDemoteSoleOwner =
    member.isCurrentUser && member.role === "owner" && ownerCount <= 1;

  return (
    <Select
      value={member.role}
      disabled={disabled}
      onValueChange={(value) => {
        const role = teamRoleFromValue(value);
        if (role) {
          onChange(member.userId, role);
        }
      }}
    >
      <SelectTrigger aria-label={`Change role for ${member.name}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TEAM_ROLES.map((role) => (
          <SelectItem
            key={role}
            value={role}
            disabled={cannotDemoteSoleOwner && role !== "owner"}
          >
            {roleLabel(role)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InviteRoleSelect() {
  return (
    <Select name="role" defaultValue="member">
      <SelectTrigger id="invite-role" aria-label="Invitation role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TEAM_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {roleLabel(role)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RemoveMemberDialog({
  member,
  ownerCount,
  disabled,
  onConfirm,
}: {
  member: TeamMember;
  ownerCount: number;
  disabled: boolean;
  onConfirm: (userId: string) => void;
}) {
  const cannotRemove = member.role === "owner" && ownerCount <= 1;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${member.name}`}
          disabled={disabled || cannotRemove}
        >
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {member.name}?</DialogTitle>
          <DialogDescription>
            Their current sessions will lose team access on the next authorized
            request because the membership row will be removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant="destructive"
              onClick={() => onConfirm(member.userId)}
            >
              Remove
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function focusAdjacentRow(event: React.KeyboardEvent<HTMLTableSectionElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    return;
  }

  const target = event.target as HTMLElement;
  const currentRow = target.closest<HTMLTableRowElement>("[data-roving-row]");
  const tableBody = event.currentTarget;
  const rows = Array.from(
    tableBody.querySelectorAll<HTMLTableRowElement>("[data-roving-row]")
  );

  if (!currentRow || rows.length === 0) {
    return;
  }

  event.preventDefault();

  const currentIndex = rows.indexOf(currentRow);
  const offset = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = (currentIndex + offset + rows.length) % rows.length;
  rows[nextIndex]?.focus();
}

async function copyToClipboard(value: string) {
  if (!navigator.clipboard) {
    throw new Error("Clipboard access is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function roleLabel(role: TeamRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function teamRoleFromValue(value: unknown): TeamRole | null {
  return TEAM_ROLES.find((role) => role === value) ?? null;
}
