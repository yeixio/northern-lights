// Sends a Supabase invite email to a new member.
//
// Public sign-ups are disabled for Northern Lights, so this is the only way
// in: an approved member calls this function, it records the invitation and
// asks Supabase Auth to email a magic link. When the invitee accepts, the
// handle_new_user trigger sees the open invitation and approves them.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identify the caller with their own JWT.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: "Not signed in" }, 401);

  const { data: isMember } = await caller.rpc("is_member");
  if (!isMember) return json({ error: "Only approved members can send invites" }, 403);

  let body: { email?: string; message?: string; redirectTo?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "A valid email address is required" }, 400);
  }

  const admin = createClient(url, serviceKey);

  const { data: existing } = await admin
    .from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return json({ error: "That person is already a member" }, 409);

  // An open invitation for this email may already exist; re-sending is fine.
  const { error: insertError } = await admin.from("invitations").insert(
    { email, invited_by: user.id, message: body.message ?? null },
  );
  if (insertError && insertError.code !== "23505") {
    return json({ error: insertError.message }, 500);
  }

  const redirectTo = body.redirectTo ?? `${req.headers.get("origin") ?? ""}/welcome`;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { invited_by: user.id },
  });
  if (inviteError) return json({ error: inviteError.message }, 400);

  return json({ ok: true });
});
