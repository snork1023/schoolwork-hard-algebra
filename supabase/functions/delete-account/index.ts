import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const listUserFiles = async (adminClient: ReturnType<typeof createClient>, bucket: string, userId: string) => {
  const { data, error } = await adminClient.storage.from(bucket).list(userId, { limit: 1000 });
  if (error?.message.toLowerCase().includes("bucket not found")) return [];
  if (error) throw error;
  return (data ?? []).map((file) => `${userId}/${file.name}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    for (const bucket of ["avatars", "chat-attachments"]) {
      const files = await listUserFiles(adminClient, bucket, user.id);
      if (files.length > 0) {
        const { error } = await adminClient.storage.from(bucket).remove(files);
        if (error) throw error;
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ success: true }, 200);
  } catch (error) {
    console.error("Account deletion failed:", error);
    return json({ error: "Failed to permanently delete account" }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
