import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-utils";

type Conversation = {
  id: string;
  name: string | null;
  type: 'dm' | 'group';
};

type RenameConversationDialogProps = {
  conversation: Conversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => void;
};

const RenameConversationDialog = ({
  conversation,
  open,
  onOpenChange,
  onRenamed,
}: RenameConversationDialogProps) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (conversation) {
      setName(conversation.name || "");
    }
  }, [conversation]);

  const handleRename = async () => {
    if (!conversation) return;

    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ name: name.trim() })
        .eq("id", conversation.id);

      if (error) throw error;

      toast({ title: "Conversation renamed successfully" });
      onRenamed();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error renaming conversation",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conversationName">Name</Label>
            <Input
              id="conversationName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter conversation name"
              maxLength={100}
            />
          </div>

          <Button onClick={handleRename} disabled={loading} className="w-full">
            Rename
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RenameConversationDialog;
