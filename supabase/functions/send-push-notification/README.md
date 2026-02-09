# send-push-notification

Edge Function that sends push notifications via Expo Push API.

## Payloads accepted

1. **Message push (from pg_net or internal call)**  
   `{ "expo_push_token": "...", "title": "...", "body": "...", "data": { ... } }`  
   → Forwards to Expo; returns 200 on success.

2. **Database Webhook (messages / organization_messages)**  
   `{ "type": "INSERT", "table": "messages" | "organization_messages", "record": { ... } }`  
   → Resolves recipient(s), fetches Expo token(s), sends push(es); returns 200.

## Deploy

From the project root (or from a repo that has this `supabase/functions` folder linked to your Supabase project):

```bash
supabase functions deploy send-push-notification
```

Or in Supabase Dashboard: **Edge Functions** → **Deploy new function** and paste the contents of `index.ts`.

## Env

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set automatically when the function runs on Supabase.  
- No extra secrets needed for Expo (public API).

## If you already had a different send-push-notification

If your existing function handled utskick/events with another payload shape, merge that logic into this `index.ts` (e.g. another `if` branch before the final 400) so one function handles all cases.
