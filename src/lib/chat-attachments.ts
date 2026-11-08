import { supabase } from "@/integrations/supabase/client";

export const removeChatAttachmentObjects = async (
  paths: readonly string[],
  userId: string,
) => {
  const ownedPaths = [...new Set(paths.filter(path => {
    const segments = path.split("/");
    return (
      segments.length === 3 &&
      segments.every(segment => segment && segment !== "." && segment !== "..") &&
      segments[1] === userId
    );
  }))];

  if (ownedPaths.length === 0) return;

  const { error } = await supabase.storage
    .from("chat-attachments")
    .remove(ownedPaths);
  if (error) throw error;
};
