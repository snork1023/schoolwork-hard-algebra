import { cn } from "@/lib/utils";

type Status = 'online' | 'idle' | 'dnd' | 'offline';

type StatusIndicatorProps = {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const statusColors: Record<Status, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-muted-foreground/50',
};

const statusLabels: Record<Status, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
};

export const StatusIndicator = ({ status, size = 'md', className }: StatusIndicatorProps) => {
  return (
    <div
      className={cn(
        'rounded-full border-2 border-background',
        statusColors[status],
        sizeClasses[size],
        className
      )}
      title={statusLabels[status]}
    />
  );
};

export const getStatusLabel = (status: Status) => statusLabels[status];
export type { Status };
