import clsx from "clsx";
import type { User } from "@/lib/chime/types";

const sizes = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl",
  xl: "h-20 w-20 text-3xl",
};

const statusColors: Record<User["status"], string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-gray-400",
};

export function Avatar({
  user,
  size = "md",
  showStatus = false,
  className,
}: {
  user: Pick<
    User,
    "displayName" | "username" | "avatarColor" | "avatarEmoji" | "avatarUrl" | "status"
  >;
  size?: keyof typeof sizes;
  showStatus?: boolean;
  className?: string;
}) {
  const initials = (user.displayName || user.username || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={clsx("relative inline-flex shrink-0", className)}>
      <div
        className={clsx(
          "flex items-center justify-center overflow-hidden rounded-full font-semibold text-white shadow-sm ring-2 ring-card",
          sizes[size]
        )}
        style={user.avatarUrl ? undefined : { backgroundColor: user.avatarColor }}
        aria-hidden
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : user.avatarEmoji ? (
          <span className="leading-none">{user.avatarEmoji}</span>
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {showStatus && (
        <span
          className={clsx(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card",
            statusColors[user.status]
          )}
        />
      )}
    </div>
  );
}
