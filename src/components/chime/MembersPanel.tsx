import { useChime } from "./ChimeProvider";
import { Avatar } from "./Avatar";
import type { ID, User } from "@/lib/chime/types";

export function MembersPanel({
  memberIds,
  title = "Members",
}: {
  memberIds: ID[];
  title?: string;
}) {
  const { state } = useChime();
  const members = memberIds
    .map((id) => state.users[id])
    .filter((u): u is User => Boolean(u));

  const online = members.filter((m) => m.status !== "offline");
  const offline = members.filter((m) => m.status === "offline");

  return (
    <aside className="hidden h-full w-60 flex-col border-l border-border bg-card/60 lg:flex">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          {title} — {members.length}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {online.length > 0 && (
          <Section title={`Online — ${online.length}`}>
            {online.map((m) => (
              <MemberRow key={m.id} user={m} />
            ))}
          </Section>
        )}
        {offline.length > 0 && (
          <Section title={`Offline — ${offline.length}`}>
            {offline.map((m) => (
              <MemberRow key={m.id} user={m} />
            ))}
          </Section>
        )}
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function MemberRow({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
      <Avatar user={user} size="sm" showStatus />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {user.displayName}
        </div>
        <div className="truncate text-xs text-muted-foreground">@{user.username}</div>
      </div>
    </div>
  );
}
