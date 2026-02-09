# Message push notifications via Database Webhook

Use a **Database Webhook** to call your Edge Function when a new row is inserted into `messages` or `organization_messages`. The Edge Function then sends the push via Expo.

## 1. Create the webhook (Supabase Dashboard)

1. Go to **Database** → **Webhooks** → **Create a new hook**.
2. **Table**: `messages`  
   **Events**: Insert  
   **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notification`  
   (Use your existing `send-push-notification` if you extend it for webhook payloads, or a thin function that calls it; replace with your project ref.)
3. Optionally add a second webhook for **Table**: `organization_messages**, same URL (or a dedicated function).

## 2. Webhook payload (what the Edge Function receives)

Supabase sends a POST body like:

```json
{
  "type": "INSERT",
  "table": "messages",
  "schema": "public",
  "record": {
    "id": "uuid",
    "conversation_id": "uuid",
    "sender_id": "uuid",
    "content": "Hello",
    "created_at": "2025-02-03T12:00:00Z",
    ...
  },
  "old_record": null
}
```

For `organization_messages` the payload has `"table": "organization_messages"` and `record` includes `organization_conversation_id`, `sender_id`, `content`, etc.

## 3. Use your existing `send-push-notification` function

You can use the same Edge Function **`send-push-notification`** that you use for utskick/events.

**Option A – Webhook calls a thin “message” function that then calls `send-push-notification`**  
Create a small function (e.g. `on-message-insert`) that the webhook calls: it parses the insert payload, resolves recipient(s) and token(s), then for each token POSTs to your existing `send-push-notification` with body `{ expo_push_token, title, body, data }`. No changes to `send-push-notification` needed.

**Option B – Webhook calls `send-push-notification`; function handles two shapes**  
Point the webhook at `send-push-notification`. In that function: if the body has **`type`/`table`/`record`** (webhook payload), do the recipient/token lookup and then send to Expo (or call yourself with the “direct” payload below); if the body has **`expo_push_token`**, send that payload to Expo as you already do for utskick/events.

**Payload your `send-push-notification` already receives (from pg_net / message queue):**

```json
{
  "expo_push_token": "ExponentPushToken[xxx]",
  "title": "Sender name",
  "body": "Message preview or [Bild]",
  "data": { "type": "message", "conversation_id": "uuid", "conversation_type": "direct" | "organization" }
}
```

So: **yes, use `send-push-notification`**. Ensure it accepts this shape (when `expo_push_token` is present) and forwards to Expo; then message push (pg_net or webhook) can use the same function.

## 4. Edge Function responsibilities (if you add webhook → same function)

If the webhook calls `send-push-notification` with raw DB payload, the function should:

1. **Parse** `req.body` and read `type`, `table`, `record`.
2. **If table is `messages`** (direct):
   - Get the other participant: query `conversations` where `id = record.conversation_id`, then `recipient_id = participant1_id === record.sender_id ? participant2_id : participant1_id`.
   - Get sender display name from `user_profiles` where `id = record.sender_id`.
   - Get recipient `expo_push_token` from `user_profiles` where `id = recipient_id` and (optionally) `push_notifications = true`.
   - Build body: `title = sender name`, `body = record.content` (truncated) or `[Bild]`, `data = { type: 'message', conversation_id, conversation_type: 'direct' }`.
   - POST to `https://exp.host/--/api/v2/push/send` with `{ to: expo_push_token, title, body, data }`.
3. **If table is `organization_messages`** (group):
   - Get member user_ids from `organization_conversation_members` where `organization_conversation_id = record.organization_conversation_id` and `user_id != record.sender_id`.
   - For each user, get `expo_push_token` from `user_profiles` and send one push per token (same title/body/data with `conversation_type: 'organization'`).
4. Use **service role** (or a DB client with RLS bypass) in the Edge Function to read `conversations`, `user_profiles`, and `organization_conversation_members`.

## 5. Summary

| Step              | Action                                                |
|-------------------|--------------------------------------------------------|
| New message insert| Supabase fires webhook → POST to your Edge Function   |
| Edge Function     | Resolve recipient(s), get Expo token(s), send to Expo  |
| App               | Receives push; tap opens conversation (already in app) |

No pg_net or `message_push_queue` table required when using webhooks.
