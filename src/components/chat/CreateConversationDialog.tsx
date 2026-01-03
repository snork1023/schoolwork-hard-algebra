import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/error-utils";

const usernameSchema = z.string().trim().min(1, "Username cannot be empty").max(50);
const groupNameSchema = z.string().trim().min(1, "Group name cannot be empty").max(100);

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
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUsers();
      setSelectedUsers([]);
      setSearchQuery("");
      setGroupName("");
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
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } else {
      setUsers(data || []);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedUsers.some((selected) => selected.id === user.id)
  );

  const addUser = (user: Profile) => {
    const validation = usernameSchema.safeParse(user.username);
    if (!validation.success) {
      toast({
        title: "Invalid username",
        variant: "destructive",
      });
      return;
    }
    setSelectedUsers((prev) => [...prev, user]);
    setSearchQuery("");
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((user) => user.id !== userId));
  };

  const handleCreateDM = async () => {
    if (loading) return;
    
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
          { conversation_id: conversation.id, user_id: selectedUsers[0].id },
        ]);

      if (partError) throw partError;

      toast({ title: "DM created successfully" });
      onConversationCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error creating DM",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (loading) return;
    
    if (selectedUsers.length < 1) {
      toast({
        title: "Select users",
        description: "Please select at least one user for a group chat",
        variant: "destructive",
      });
      return;
    }

    const groupNameValidation = groupNameSchema.safeParse(groupName);
    if (!groupNameValidation.success) {
      toast({
        title: "Invalid group name",
        description: groupNameValidation.error.errors[0].message,
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
          name: groupNameValidation.data,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants (current user + selected users)
      const participants = [
        { conversation_id: conversation.id, user_id: currentUserId },
        ...selectedUsers.map((user) => ({
          conversation_id: conversation.id,
          user_id: user.id,
        })),
      ];

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert(participants);

      if (partError) throw partError;

      toast({ title: "Group created successfully" });
      onConversationCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error creating group",
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
          <DialogTitle>Create New Chat</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dm">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dm">Direct Message</TabsTrigger>
            <TabsTrigger value="group">Group Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="dm" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dmSearch">Search User</Label>
              <Input
                id="dmSearch"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type username to search..."
                maxLength={50}
              />
            </div>

            {selectedUsers.length > 0 && (
              <div className="space-y-2">
                <Label>Selected User</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <Badge key={user.id} variant="secondary" className="pr-1">
                      {user.username}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-transparent"
                        onClick={() => removeUser(user.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {searchQuery && filteredUsers.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md">
                {filteredUsers.slice(0, 10).map((user) => (
                  <div
                    key={user.id}
                    className="p-2 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => addUser(user)}
                  >
                    {user.username}
                  </div>
                ))}
              </div>
            )}

            <Button type="button" onClick={handleCreateDM} disabled={loading || selectedUsers.length !== 1} className="w-full">
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
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupSearch">Search Members</Label>
              <Input
                id="groupSearch"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type username to search..."
                maxLength={50}
              />
            </div>

            {selectedUsers.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Members ({selectedUsers.length})</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {selectedUsers.map((user) => (
                    <Badge key={user.id} variant="secondary" className="pr-1">
                      {user.username}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-transparent"
                        onClick={() => removeUser(user.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {searchQuery && filteredUsers.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md">
                {filteredUsers.slice(0, 10).map((user) => (
                  <div
                    key={user.id}
                    className="p-2 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => addUser(user)}
                  >
                    {user.username}
                  </div>
                ))}
              </div>
            )}

            <Button type="button" onClick={handleCreateGroup} disabled={loading || selectedUsers.length < 1} className="w-full">
              Create Group
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CreateConversationDialog;
