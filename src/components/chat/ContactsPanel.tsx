import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/data-display/avatar";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/forms/input";
import { ScrollArea } from "@/components/ui/layout/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-utils";
import { Ban, Loader2, MessageSquarePlus, Search, ShieldCheck, User, UserMinus, UserPlus, X } from "lucide-react";

export type ContactProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type ContactsPanelProps = {
  currentUserId: string;
  onSelectContact: (contact: ContactProfile) => void;
  onViewContact: (contact: ContactProfile) => void;
  onBlockContact: (contact: ContactProfile) => Promise<boolean>;
};

const ContactsPanel = ({ currentUserId, onSelectContact, onViewContact, onBlockContact }: ContactsPanelProps) => {
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [blockedContacts, setBlockedContacts] = useState<ContactProfile[]>([]);
  const [directory, setDirectory] = useState<ContactProfile[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [findOpen, setFindOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [pendingContactAction, setPendingContactAction] = useState<{
    id: string;
    action: "toggle" | "block" | "unblock";
  } | null>(null);
  const [openingContactId, setOpeningContactId] = useState<string | null>(null);
  const { toast } = useToast();
  const lastSearchVersionRef = useRef(searchVersion);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const fetchContacts = async () => {
      setLoading(true);
      try {
        const [followsResult, blocksResult] = await Promise.all([
          supabase
            .from("profile_follows")
            .select("followed_id")
            .eq("follower_id", currentUserId),
          supabase
            .from("profile_blocks")
            .select("blocked_id")
            .eq("blocker_id", currentUserId),
        ]);
        if (followsResult.error) throw followsResult.error;
        if (blocksResult.error) throw blocksResult.error;

        const ids = (followsResult.data ?? []).map((follow) => follow.followed_id);
        const blockedProfileIds = (blocksResult.data ?? []).map((block) => block.blocked_id);
        let contactProfiles: ContactProfile[] = [];
        let blockedProfileRecords: ContactProfile[] = [];
        if (ids.length > 0) {
          const profilesResult = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", ids)
            .order("username");
          if (profilesResult.error) throw profilesResult.error;
          contactProfiles = profilesResult.data ?? [];
        }
        if (blockedProfileIds.length > 0) {
          const profilesResult = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", blockedProfileIds)
            .order("username");
          if (profilesResult.error) throw profilesResult.error;
          blockedProfileRecords = profilesResult.data ?? [];
        }

        if (!active) return;
        setFollowedIds(new Set(ids));
        setBlockedIds(new Set(blockedProfileIds));
        setContacts(contactProfiles);
        setBlockedContacts(blockedProfileRecords);
      } catch (error: unknown) {
        if (!active) return;
        toast({
          title: "Error loading contacts",
          description: getUserFriendlyError(error),
          variant: "destructive",
        });
        setContacts([]);
        setFollowedIds(new Set());
        setBlockedContacts([]);
        setBlockedIds(new Set());
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchContacts();
    return () => {
      active = false;
    };
  }, [currentUserId, toast]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!findOpen || !searchResultsOpen || query.length < 2) return;

    const searchImmediately = searchVersion !== lastSearchVersionRef.current;
    lastSearchVersionRef.current = searchVersion;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .neq("id", currentUserId)
          .eq("discoverable", true)
          .ilike("username", `%${query}%`)
          .order("username")
          .limit(20)
          .abortSignal(controller.signal);
        if (error) throw error;
        if (active) setDirectory(data ?? []);
      } catch (error: unknown) {
        if (!active || controller.signal.aborted) return;
        toast({
          title: "Error finding contacts",
          description: getUserFriendlyError(error),
          variant: "destructive",
        });
        setDirectory([]);
      } finally {
        if (active) setDirectoryLoading(false);
      }
    }, searchImmediately ? 0 : 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [currentUserId, findOpen, searchQuery, searchResultsOpen, searchVersion, toast]);

  useEffect(() => {
    if (!findOpen || !searchResultsOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !searchContainerRef.current?.contains(event.target)
      ) {
        setSearchResultsOpen(false);
        setDirectoryLoading(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [findOpen, searchResultsOpen]);

  const handleToggleFollow = async (contact: ContactProfile) => {
    if (pendingContactAction || blockedIds.has(contact.id)) return;
    const isFollowing = followedIds.has(contact.id);
    setPendingContactAction({ id: contact.id, action: "toggle" });
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("profile_follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("followed_id", contact.id);
        if (error) throw error;
        setFollowedIds((ids) => {
          const next = new Set(ids);
          next.delete(contact.id);
          return next;
        });
        setContacts((items) => items.filter((item) => item.id !== contact.id));
      } else {
        const { error } = await supabase
          .from("profile_follows")
          .insert({ follower_id: currentUserId, followed_id: contact.id });
        if (error) throw error;
        setFollowedIds((ids) => new Set(ids).add(contact.id));
        setContacts((items) =>
          [...items.filter((item) => item.id !== contact.id), contact].sort((a, b) =>
            a.username.localeCompare(b.username),
          ),
        );
      }
    } catch (error: unknown) {
      toast({
        title: isFollowing ? "Error unfollowing user" : "Error following user",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setPendingContactAction(null);
    }
  };

  const handleBlockContact = async (contact: ContactProfile) => {
    if (pendingContactAction) return;
    if (!window.confirm(`Block ${contact.username}? This removes your follows and deletes all DMs between you.`)) return;

    setPendingContactAction({ id: contact.id, action: "block" });
    try {
      const blocked = await onBlockContact(contact);
      if (!blocked) return;
      setFollowedIds((ids) => {
        const next = new Set(ids);
        next.delete(contact.id);
        return next;
      });
      setBlockedIds((ids) => new Set(ids).add(contact.id));
      setContacts((items) => items.filter((item) => item.id !== contact.id));
      setBlockedContacts((items) =>
        [...items.filter((item) => item.id !== contact.id), contact].sort((a, b) =>
          a.username.localeCompare(b.username),
        ),
      );
    } finally {
      setPendingContactAction(null);
    }
  };

  const handleUnblockContact = async (contact: ContactProfile) => {
    if (pendingContactAction) return;
    setPendingContactAction({ id: contact.id, action: "unblock" });
    try {
      const { error } = await supabase
        .from("profile_blocks")
        .delete()
        .eq("blocker_id", currentUserId)
        .eq("blocked_id", contact.id);
      if (error) throw error;
      setBlockedIds((ids) => {
        const next = new Set(ids);
        next.delete(contact.id);
        return next;
      });
      setBlockedContacts((items) => items.filter((item) => item.id !== contact.id));
    } catch (error: unknown) {
      toast({
        title: "Error unblocking user",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setPendingContactAction(null);
    }
  };

  const handleNewChat = async (contact: ContactProfile) => {
    if (openingContactId || pendingContactAction || blockedIds.has(contact.id)) return;
    setOpeningContactId(contact.id);
    try {
      await onSelectContact(contact);
    } finally {
      setOpeningContactId(null);
    }
  };

  const renderContactRow = (contact: ContactProfile) => {
    const isFollowing = followedIds.has(contact.id);
    const isBlocked = blockedIds.has(contact.id);
    const busy = pendingContactAction !== null || openingContactId !== null;
    const actionClassName = "h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";

    return (
      <div
        key={contact.id}
        className="flex min-h-14 items-center gap-3 border-b border-border/60 px-4 py-2 transition-colors last:border-b-0 hover:bg-muted/40"
      >
        <button
          type="button"
          onClick={() => onViewContact(contact)}
          aria-label={`View ${contact.username}'s contact card`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-9 w-9 shrink-0">
            {contact.avatar_url && <AvatarImage src={contact.avatar_url} alt="" />}
            <AvatarFallback>
              <User className="h-4 w-4 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium">{contact.username}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Create DM with ${contact.username}`}
            title="Create DM"
            disabled={busy || isBlocked}
            onClick={() => void handleNewChat(contact)}
            className={actionClassName}
          >
            {openingContactId === contact.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquarePlus className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`${isFollowing ? "Unfollow" : "Follow"} ${contact.username}`}
            title={isFollowing ? "Unfollow" : "Follow"}
            disabled={busy || isBlocked}
            onClick={() => void handleToggleFollow(contact)}
            className={actionClassName}
          >
            {pendingContactAction?.id === contact.id && pendingContactAction.action === "toggle" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isFollowing ? (
              <UserMinus className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
          </Button>
          {isBlocked ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Unblock ${contact.username}`}
              title="Unblock"
              disabled={busy}
              onClick={() => void handleUnblockContact(contact)}
              className={actionClassName}
            >
              {pendingContactAction?.id === contact.id && pendingContactAction.action === "unblock" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Block ${contact.username}`}
              title="Block"
              disabled={busy}
              onClick={() => void handleBlockContact(contact)}
              className={actionClassName}
            >
              {pendingContactAction?.id === contact.id && pendingContactAction.action === "block" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-3 mb-3 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div>
          <h1 className="text-base font-semibold">{blockedOpen ? "Blocked users" : "Contacts"}</h1>
          <p className="text-xs text-muted-foreground">
            {blockedOpen
              ? `${blockedContacts.length} ${blockedContacts.length === 1 ? "blocked user" : "blocked users"}`
              : `${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={blockedOpen ? "secondary" : "outline"}
            size="sm"
            disabled={loading || directoryLoading}
            onClick={() => {
              setBlockedOpen((open) => !open);
              setFindOpen(false);
              setSearchResultsOpen(false);
              setSearchQuery("");
              setDirectory([]);
              setDirectoryLoading(false);
            }}
            className="rounded-lg"
          >
            {blockedOpen ? "Contacts" : "Blocked"}
          </Button>
          {!blockedOpen && (
            <div ref={searchContainerRef} className="relative">
              <div
                className={`flex h-9 items-center justify-end overflow-hidden transition-[width] duration-200 ease-out ${
                  findOpen ? "w-[min(20rem,55vw)]" : "w-32"
                }`}
              >
                {findOpen ? (
                  <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-border bg-background/80 focus-within:border-border">
                    <Input
                      type="text"
                      role="searchbox"
                      aria-label="Find a contact"
                      aria-controls={searchResultsOpen ? "contact-search-results" : undefined}
                      autoFocus
                      placeholder="Search usernames"
                      value={searchQuery}
                      onFocus={() => {
                        if (searchQuery.trim()) {
                          setSearchResultsOpen(true);
                          setDirectoryLoading(searchQuery.trim().length >= 2);
                        }
                      }}
                      onChange={(event) => {
                        const query = event.target.value;
                        setSearchQuery(query);
                        setDirectory([]);
                        setDirectoryLoading(query.trim().length >= 2);
                        setSearchResultsOpen(Boolean(query.trim()));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && searchQuery.trim()) {
                          setSearchVersion((version) => version + 1);
                          setDirectoryLoading(searchQuery.trim().length >= 2);
                          setSearchResultsOpen(true);
                        } else if (event.key === "Escape") {
                          setFindOpen(false);
                          setSearchResultsOpen(false);
                          setSearchQuery("");
                          setDirectory([]);
                          setDirectoryLoading(false);
                        }
                      }}
                      className="h-full min-w-0 flex-1 rounded-md border-0 bg-transparent py-0 shadow-none ring-0 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={loading}
                      aria-label={searchQuery.trim() ? "Search contacts" : "Close contact search"}
                      onClick={() => {
                        if (searchQuery.trim()) {
                          setSearchVersion((version) => version + 1);
                          setDirectoryLoading(searchQuery.trim().length >= 2);
                          setSearchResultsOpen(true);
                        } else {
                          setFindOpen(false);
                          setSearchResultsOpen(false);
                          setDirectoryLoading(false);
                        }
                      }}
                      className="mr-1 h-7 w-7 shrink-0 rounded-md bg-transparent p-0 text-muted-foreground shadow-none hover:scale-100 hover:bg-transparent hover:text-foreground active:scale-100"
                    >
                      {searchQuery.trim() ? (
                        <Search className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    aria-label="Find contact"
                    onClick={() => setFindOpen(true)}
                    className="h-9 rounded-lg"
                  >
                    <Search className="h-4 w-4" />
                    Find contact
                  </Button>
                )}
              </div>
              {findOpen && searchResultsOpen && searchQuery.trim() && (
                <div
                  id="contact-search-results"
                  className="absolute right-0 top-full z-50 mt-2 max-h-64 w-[min(20rem,80vw)] overflow-y-auto rounded-xl border border-border bg-card/90 shadow-sm backdrop-blur-md"
                >
                  {directoryLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchQuery.trim().length < 2 ? (
                    <p className="px-4 py-3 text-center text-sm text-muted-foreground">
                      Enter at least 2 characters to search
                    </p>
                  ) : directory.length > 0 ? (
                    directory.map((contact) => renderContactRow(contact))
                  ) : (
                    <p className="px-4 py-3 text-center text-sm text-muted-foreground">
                      No users found
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {blockedOpen ? (
          blockedContacts.length > 0 ? (
            <div>{blockedContacts.map((contact) => renderContactRow(contact))}</div>
          ) : (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-medium">No blocked users</p>
            </div>
          )
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length > 0 ? (
          <div>{contacts.map((contact) => renderContactRow(contact))}</div>
        ) : (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium">No contacts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Follow someone to add them to your contacts.
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ContactsPanel;
