import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/overlays/dialog";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/forms/input";
import { Label } from "@/components/ui/forms/label";
import { Badge } from "@/components/ui/data-display/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X, Search, Users } from "lucide-react";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/error-utils";
const usernameSchema = z.string().trim().min(1, "Username cannot be empty").max(50);
const groupNameSchema = z.string().trim().min(1, "Group name cannot be empty").max(100);
type Profile = {
  id: string;
  username: string;
  discoverable?: boolean;
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
  onConversationCreated
}: CreateConversationDialogProps) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    toast
  } = useToast();
  const handleSearch = () => {
    setHasSearched(true);
    if (!searchQuery.trim()) {
      setFilteredUsers([]);
      return;
    }
    
    // Filter users with exact username match (case-insensitive)
    const results = users.filter(
      user =>
        user.username.toLowerCase() === searchQuery.toLowerCase().trim() &&
        !selectedUsers.some(selected => selected.id === user.id)
    );
    setFilteredUsers(results);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const fetchUsers = useCallback(async () => {
    // Only fetch users who are discoverable (allow message requests)
    const {
      data,
      error
    } = await supabase.from("profiles").select("id, username, discoverable").neq("id", currentUserId).eq("discoverable", true);
    if (error) {
      toast({
        title: "Error loading users",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } else {
      setUsers(data || []);
    }
  }, [currentUserId, toast]);

  useEffect(() => {
    // Fetching profiles is an external synchronization; the callback updates state when it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) fetchUsers();
  }, [open, fetchUsers]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedUsers([]);
      setSearchQuery("");
      setFilteredUsers([]);
      setHasSearched(false);
      setGroupName("");
    }
    onOpenChange(nextOpen);
  };

  const addUser = (user: Profile) => {
    const validation = usernameSchema.safeParse(user.username);
    if (!validation.success) {
      toast({
        title: "Invalid username",
        variant: "destructive"
      });
      return;
    }
    setSelectedUsers(prev => [...prev, user]);
    setSearchQuery("");
    setFilteredUsers([]);
    setHasSearched(false);
  };
  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(user => user.id !== userId));
  };
  const handleCreateGroup = async () => {
    if (loading) return;
    if (selectedUsers.length < 1) {
      toast({
        title: "Select users",
        description: "Please select at least one user for a group chat",
        variant: "destructive"
      });
      return;
    }
    const groupNameValidation = groupNameSchema.safeParse(groupName);
    if (!groupNameValidation.success) {
      toast({
        title: "Invalid group name",
        description: groupNameValidation.error.issues[0].message,
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      // Create conversation
      const {
        data: conversation,
        error: convError
      } = await supabase.from("conversations").insert({
        type: "group",
        name: groupNameValidation.data,
        created_by: currentUserId
      }).select().single();
      if (convError) throw convError;

      // Add participants (current user + selected users)
      const participants = [{
        conversation_id: conversation.id,
        user_id: currentUserId
      }, ...selectedUsers.map(user => ({
        conversation_id: conversation.id,
        user_id: user.id
      }))];
      const {
        error: partError
      } = await supabase.from("conversation_participants").insert(participants);
      if (partError) throw partError;
      toast({
        title: "Group created successfully"
      });
      onConversationCreated();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Error creating group",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  return <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create group chat</DialogTitle>
          <DialogDescription>Start a group conversation with people you choose.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group name</Label>
            <Input id="groupName" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Enter a group name" maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupSearch">Add members</Label>
            <div className="flex gap-2">
              <Input
                id="groupSearch"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                placeholder="Enter a username"
                maxLength={50}
              />
              <Button
                type="button"
                onClick={handleSearch}
                variant="outline"
                size="icon"
                aria-label="Search users"
                className="shrink-0"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label>Selected members ({selectedUsers.length})</Label>
              <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {selectedUsers.map(user => (
                  <Badge key={user.id} variant="secondary" className="pr-1">
                    {user.username}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${user.username}`}
                      className="ml-1 h-5 w-5 hover:bg-transparent"
                      onClick={() => removeUser(user.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {hasSearched && searchQuery.trim() && filteredUsers.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
              {filteredUsers.map(user => (
                <Button
                  key={user.id}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => addUser(user)}
                >
                  {user.username}
                </Button>
              ))}
            </div>
          )}

          {hasSearched && searchQuery.trim() && filteredUsers.length === 0 && (
            <p className="rounded-lg border border-dashed border-border py-3 text-center text-sm text-muted-foreground">
              No user found with that username
            </p>
          )}

          <Button type="button" onClick={handleCreateGroup} disabled={loading || selectedUsers.length < 1} className="w-full">
            {loading ? "Creating group…" : "Create group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>;
};
export default CreateConversationDialog;