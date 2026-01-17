import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusIndicator, getStatusLabel, type Status } from "./StatusIndicator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Circle, Moon, MinusCircle, CircleOff, X } from "lucide-react";

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
  const [message, setMessage] = useState(statusMessage || '');
  const [isEditing, setIsEditing] = useState(false);
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

  const updateStatusMessage = async () => {
    const newMessage = message.trim() || null;
    const { error } = await supabase
      .from('profiles')
      .update({ status_message: newMessage })
      .eq('id', userId);

    if (error) {
      toast({ title: "Error updating status message", variant: "destructive" });
    } else {
      onStatusChange(currentStatus, newMessage);
      setIsEditing(false);
    }
  };

  const clearStatusMessage = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({ status_message: null })
      .eq('id', userId);

    if (error) {
      toast({ title: "Error clearing status", variant: "destructive" });
    } else {
      setMessage('');
      onStatusChange(currentStatus, null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 hover:bg-accent/50 rounded-lg p-1 transition-colors">
          <StatusIndicator status={currentStatus} size="md" />
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {statusMessage || getStatusLabel(currentStatus)}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {statusOptions.map(({ status, icon, label }) => (
          <DropdownMenuItem
            key={status}
            onClick={() => updateStatus(status)}
            className="flex items-center gap-2"
          >
            {icon}
            <span>{label}</span>
            {currentStatus === status && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="p-2">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Set a custom status..."
                maxLength={128}
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={updateStatusMessage} className="flex-1 h-7">
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  className="h-7"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="flex-1 h-8 justify-start text-sm"
              >
                {statusMessage ? 'Edit status message' : 'Set a custom status'}
              </Button>
              {statusMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearStatusMessage}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
