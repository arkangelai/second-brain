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

export function TeamAdminClient({ data }: { data: AdminTeamPageData }) {
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
    const role = formData.get("role");

    if (!email || typeof role !== "string") {
      toast.error("Enter an email and choose a role.");
      return;
    }

    const optimisticInvite: PendingInvitation = {
      id: `pending-${Date.now()}`,
      email,
      role: role as TeamRole,
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
    <main className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {teamName}
              </h1>
              <Badge variant="secondary">{roleLabel(data.currentUser.role)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage team settings, human members, and active invitations.
            </p>
          </div>
          <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{data.team.slug}</span>
          </div>
        </header>

        <section className="grid gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)] md:p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-medium">Team settings</h2>
            <p className="text-sm text-muted-foreground">
              Rename the team and review immutable identifiers.
            </p>
          </div>

          <div className="space-y-5">
            <form className="space-y-2" onSubmit={submitRename}>
              <Label htmlFor="team-name">Team name</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="team-name"
                  name="name"
                  defaultValue={data.team.name}
                  minLength={2}
                  maxLength={80}
                  disabled={!data.permissions.canRenameTeam || isPending}
                  required
                />
                <Button
                  type="submit"
                  disabled={!data.permissions.canRenameTeam || isPending}
                >
                  {isPending ? <Loader2 className="animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </form>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Slug</dt>
                <dd className="mt-1 font-mono">{data.team.slug}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-1">{formatDate(data.team.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm md:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-medium">Members</h2>
              <p className="text-sm text-muted-foreground">
                Human team members and their current access.
              </p>
            </div>
            <Badge variant="outline">{members.length} total</Badge>
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

        <section className="grid gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm lg:grid-cols-[minmax(0,1fr)_24rem] md:p-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-medium">Pending invitations</h2>
                <p className="text-sm text-muted-foreground">
                  Open invites that have not been accepted.
                </p>
              </div>
              <Badge variant="outline">{invitations.length} pending</Badge>
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
              className="space-y-4 rounded-md border border-border bg-background p-4"
              onSubmit={submitInvite}
            >
              <div className="space-y-1">
                <h3 className="font-medium">Invite member</h3>
                <p className="text-sm text-muted-foreground">
                  Send an expiring invite link to a human teammate.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <InviteRoleSelect />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
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
      onValueChange={(value) => onChange(member.userId, value as TeamRole)}
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
