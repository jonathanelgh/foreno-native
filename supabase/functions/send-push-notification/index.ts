// Supabase Edge Function: send-push-notification
// Accepts (1) message push payload: { expo_push_token, title, body, data }
//         (2) webhook payload: { type, table, record } for messages / organization_messages
// Forwards to Expo Push API: https://exp.host/--/api/v2/push/send

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type MessagePayload = {
  expo_push_token: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type WebhookPayload = {
  type: string;
  table: string;
  record: Record<string, unknown>;
};

function isMessagePayload(body: unknown): body is MessagePayload {
  return (
    body !== null &&
    typeof body === "object" &&
    "expo_push_token" in body &&
    typeof (body as MessagePayload).expo_push_token === "string"
  );
}

function isWebhookPayload(body: unknown): body is WebhookPayload {
  return (
    body !== null &&
    typeof body === "object" &&
    "type" in body &&
    "table" in body &&
    "record" in body
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === "") {
      return new Response(JSON.stringify({ error: "Empty body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    body = JSON.parse(text);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // (1) Message push payload (from pg_net trigger or internal call)
  if (isMessagePayload(body)) {
    const token = body.expo_push_token.trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing expo_push_token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = {
      to: token,
      title: body.title ?? "",
      body: body.body ?? "",
      data: body.data ?? {},
      sound: "default",
    };

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("Expo push error:", res.status, result);
        return new Response(JSON.stringify({ error: "Expo push failed", details: result }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Expo push request failed:", err);
      return new Response(JSON.stringify({ error: "Expo request failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // (2) Webhook payload (Database Webhook on messages / organization_messages)
  if (isWebhookPayload(body) && body.type === "INSERT" && body.record) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = body.record as Record<string, unknown>;
    const table = body.table;

    if (table === "messages") {
      const conversationId = record.conversation_id as string | undefined;
      const senderId = record.sender_id as string | undefined;
      const content = (record.content as string) ?? "";

      if (!conversationId || !senderId) {
        return new Response(JSON.stringify({ error: "Missing conversation_id or sender_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const convRes = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&select=participant1_id,participant2_id`,
        { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
      );
      const convData = await convRes.json();
      const conv = Array.isArray(convData) ? convData[0] : null;
      if (!conv) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const recipientId = conv.participant1_id === senderId ? conv.participant2_id : conv.participant1_id;
      if (!recipientId || recipientId === senderId) {
        return new Response(JSON.stringify({ ok: true, skipped: "no_recipient" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles?id=eq.${senderId}&select=first_name,last_name`,
        { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
      );
      const profileData = await profileRes.json();
      const senderProfile = Array.isArray(profileData) ? profileData[0] : null;
      const firstName = (senderProfile?.first_name ?? "").trim();
      const lastName = (senderProfile?.last_name ?? "").trim();
      const senderName = [firstName, lastName].filter(Boolean).join(" ") || "Någon";

      const tokenRes = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles?id=eq.${recipientId}&select=expo_push_token,push_notifications`,
        { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
      );
      const tokenData = await tokenRes.json();
      const recipient = Array.isArray(tokenData) ? tokenData[0] : null;
      const token = recipient?.expo_push_token;
      const pushEnabled = recipient?.push_notifications !== false;
      if (!token || !pushEnabled) {
        return new Response(JSON.stringify({ ok: true, skipped: "no_token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const bodyPreview = content.trim() ? content.slice(0, 120) + (content.length > 120 ? "…" : "") : "[Bild]";
      const pushPayload = {
        to: token,
        title: senderName,
        body: bodyPreview,
        data: { type: "message", conversation_id: conversationId, conversation_type: "direct" },
        sound: "default",
      };

      const expoRes = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushPayload),
      });
      const expoResult = await expoRes.json();
      return new Response(JSON.stringify(expoResult), {
        status: expoRes.ok ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (table === "organization_messages") {
      const orgConvId = record.organization_conversation_id as string | undefined;
      const senderId = record.sender_id as string | undefined;
      const content = (record.content as string) ?? "";

      if (!orgConvId || !senderId) {
        return new Response(JSON.stringify({ error: "Missing organization_conversation_id or sender_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const membersRes = await fetch(
        `${supabaseUrl}/rest/v1/organization_conversation_members?organization_conversation_id=eq.${orgConvId}&select=user_id`,
        { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
      );
      const membersData = await membersRes.json();
      const members = Array.isArray(membersData) ? membersData : [];
      const recipientIds = members
        .map((m: { user_id: string }) => m.user_id)
        .filter((id: string) => id !== senderId);

      if (recipientIds.length === 0) {
        return new Response(JSON.stringify({ ok: true, skipped: "no_recipients" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles?id=eq.${senderId}&select=first_name,last_name`,
        { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
      );
      const profileData = await profileRes.json();
      const senderProfile = Array.isArray(profileData) ? profileData[0] : null;
      const firstName = (senderProfile?.first_name ?? "").trim();
      const lastName = (senderProfile?.last_name ?? "").trim();
      const senderName = [firstName, lastName].filter(Boolean).join(" ") || "Någon";

      const bodyPreview = content.trim() ? content.slice(0, 120) + (content.length > 120 ? "…" : "") : "[Bild]";
      const data = { type: "message", conversation_id: orgConvId, conversation_type: "organization" };

      const tokensRes = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles?id=in.(${recipientIds.join(",")})&select=id,expo_push_token,push_notifications`,
        { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
      );
      const tokensData = await tokensRes.json();
      const profiles = Array.isArray(tokensData) ? tokensData : [];
      const toTokens = profiles
        .filter((p: { expo_push_token?: string; push_notifications?: boolean }) => p.expo_push_token && p.push_notifications !== false)
        .map((p: { expo_push_token: string }) => p.expo_push_token);

      if (toTokens.length === 0) {
        return new Response(JSON.stringify({ ok: true, skipped: "no_tokens" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const messages = toTokens.map((to: string) => ({ to, title: senderName, body: bodyPreview, data, sound: "default" }));
      const expoRes = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      const expoResult = await expoRes.json();
      return new Response(JSON.stringify(expoResult), {
        status: expoRes.ok ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown table", table }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown payload: need expo_push_token or webhook type/table/record" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
});
