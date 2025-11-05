import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Profile = {
  id: string;
  username: string;
};

type CreateConversationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onConversationCreated: () => void;
};

const CreateConversationDialog = ({
  open,
  onOpenChange,
  currentUserId,
  onConversationCreated,
}: CreateConversationDialogProps) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .neq("id", currentUserId);

    if (error) {
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setUsers(data || []);
    }
  };

  const handleCreateDM = async () => {
    if (selectedUsers.length !== 1) {
      toast({
        title: "Select one user",
        description: "Please select exactly one user for a DM",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          type: "dm",
          created_by: currentUserId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert([
          { conversation_id: conversation.id, user_id: currentUserId },
          { conversation_id: conversation.id, user_id: selectedUsers[0] },
        ]);

      if (partError) throw partError;

      toast({ title: "DM created successfully" });
      onConversationCreated();
      onOpenChange(false);
      setSelectedUsers([]);
    } catch (error: any) {
      toast({
        title: "Error creating DM",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 1) {
      toast({
        title: "Select users",
        description: "Please select at least one user for a group chat",
        variant: "destructive",
      });
      return;
    }

    if (!groupName.trim()) {
      toast({
        title: "Group name required",
        description: "Please enter a name for the group",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          type: "group",
          name: groupName.trim(),
          created_by: currentUserId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants (current user + selected users)
      const participants = [
        { conversation_id: conversation.id, user_id: currentUserId },
        ...selectedUsers.map((userId) => ({
          conversation_id: conversation.id,
          user_id: userId,
        })),
      ];

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert(participants);

      if (partError) throw partError;

      toast({ title: "Group created successfully" });
      onConversationCreated();
      onOpenChange(false);
      setSelectedUsers([]);
      setGroupName("");
    } catch (error: any) {
      toast({
        title: "Error creating group",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Chat</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dm">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dm">Direct Message</TabsTrigger>
            <TabsTrigger value="group">Group Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="dm" className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.map((user) => (
                <div key={user.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dm-${user.id}`}
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => toggleUser(user.id)}
                  />
                  <label
                    htmlFor={`dm-${user.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {user.username}
                  </label>
                </div>
              ))}
            </div>
            <Button onClick={handleCreateDM} disabled={loading} className="w-full">
              Create DM
            </Button>
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              <Label>Select Members</Label>
              {users.map((user) => (
                <div key={user.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`group-${user.id}`}
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => toggleUser(user.id)}
                  />
                  <label
                    htmlFor={`group-${user.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {user.username}
                  </label>
                </div>
              ))}
            </div>

            <Button onClick={handleCreateGroup} disabled={loading} className="w-full">
              Create Group
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CreateConversationDialog;
