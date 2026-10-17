import { Dropdown } from "@/components/ui/menus/dropdown";
import { StatusIndicator, getStatusLabel, type Status } from "./StatusIndicator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Circle, Moon, MinusCircle, CircleOff } from "lucide-react";

type StatusSelectorProps = {
  currentStatus: Status;
  statusMessage: string | null;
  userId: string;
  onStatusChange: (status: Status, message: string | null) => void;
};

const statusOptions: { status: Status; icon: React.ReactNode; label: string }[] = [
  { status: 'online', icon: <Circle className="h-3 w-3 fill-green-500 text-green-500" />, label: 'Online' },
  { status: 'idle', icon: <Moon className="h-3 w-3 fill-yellow-500 text-yellow-500" />, label: 'Idle' },
  { status: 'dnd', icon: <MinusCircle className="h-3 w-3 text-red-500" />, label: 'Do Not Disturb' },
  { status: 'offline', icon: <CircleOff className="h-3 w-3 text-muted-foreground" />, label: 'Invisible' },
];

export const StatusSelector = ({
  currentStatus,
  statusMessage,
  userId,
  onStatusChange,
}: StatusSelectorProps) => {
  const { toast } = useToast();

  const updateStatus = async (status: Status) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status, last_seen: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      toast({ title: "Error updating status", variant: "destructive" });
    } else {
      onStatusChange(status, statusMessage);
    }
  };

  return (
    <Dropdown
      ariaLabel="Set your status"
      align="left"
      menuWidth={200}
      triggerClassName="glide-dropdown__trigger--plain w-auto min-w-0 border-0 bg-transparent p-1"
      triggerContent={
        <span className="flex items-center gap-2">
          <StatusIndicator status={currentStatus} size="md" />
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {statusMessage || getStatusLabel(currentStatus)}
          </span>
        </span>
      }
      options={statusOptions.map(({ status, icon, label }) => ({
        value: status,
        label: (
          <span className="flex items-center gap-2">
            {icon}
            <span>{label}</span>
          </span>
        ),
      }))}
      value={currentStatus}
      onChange={(value) => {
        const selected = statusOptions.find(
          ({ status }) => status === value,
        );
        if (selected) void updateStatus(selected.status);
      }}
    />
  );
};
