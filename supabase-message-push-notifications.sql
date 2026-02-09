-- =============================================================================
-- Push notifications for new messages (direct + group)
-- Run this in Supabase Dashboard → SQL Editor.
-- Requires: pg_net extension (Database → Extensions → enable "pg_net").
-- Before running: replace YOUR_PROJECT_REF with your Supabase project ref
--   (from Project Settings → General → Reference ID).
-- =============================================================================

-- 1. Table to queue message push notifications (one row per recipient).
--    A trigger on this table will call the edge function via pg_net.
CREATE TABLE IF NOT EXISTS public.message_push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expo_push_token text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 2. Store edge function base URL so triggers can call it.
--    Update this row after deployment with your project ref.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);
INSERT INTO public.app_settings (key, value)
VALUES ('supabase_functions_url', 'https://YOUR_PROJECT_REF.supabase.co/functions/v1')
ON CONFLICT (key) DO NOTHING;

-- 3. Helper: get display name from user_profiles
CREATE OR REPLACE FUNCTION public.get_user_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(TRIM(
      CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))
    ), ''),
    'Någon'
  )
  FROM user_profiles
  WHERE id = p_user_id;
$$;

-- 4. Trigger function: when a direct message is inserted, queue push for the other participant
CREATE OR REPLACE FUNCTION public.notify_new_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_sender_name text;
  v_token text;
  v_body text;
  v_preview text;
BEGIN
  -- Recipient is the participant who is not the sender (participants live on conversations)
  SELECT CASE
    WHEN c.participant1_id = NEW.sender_id THEN c.participant2_id
    ELSE c.participant1_id
  END INTO v_recipient_id
  FROM conversations c
  WHERE c.id = NEW.conversation_id;

  IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  v_sender_name := get_user_display_name(NEW.sender_id);
  v_preview := COALESCE(NULLIF(TRIM(NEW.content), ''), '[Bild]');
  v_body := LEFT(v_preview, 120);
  IF LENGTH(v_preview) > 120 THEN
    v_body := v_body || '…';
  END IF;

  -- Get recipient's Expo push token (only if they have push enabled)
  SELECT up.expo_push_token INTO v_token
  FROM user_profiles up
  WHERE up.id = v_recipient_id
    AND up.expo_push_token IS NOT NULL
    AND up.expo_push_token != ''
    AND (up.push_notifications IS NULL OR up.push_notifications = true);

  IF v_token IS NOT NULL THEN
    INSERT INTO public.message_push_queue (expo_push_token, title, body, data)
    VALUES (
      v_token,
      v_sender_name,
      v_body,
      jsonb_build_object(
        'type', 'message',
        'conversation_id', NEW.conversation_id,
        'conversation_type', 'direct'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Trigger function: when an organization message is inserted, queue push for all other members
CREATE OR REPLACE FUNCTION public.notify_new_organization_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_body text;
  v_preview text;
  v_member record;
  v_token text;
BEGIN
  v_sender_name := get_user_display_name(NEW.sender_id);
  v_preview := COALESCE(NULLIF(TRIM(NEW.content), ''), '[Bild]');
  v_body := LEFT(v_preview, 120);
  IF LENGTH(v_preview) > 120 THEN
    v_body := v_body || '…';
  END IF;

  FOR v_member IN
    SELECT m.user_id
    FROM organization_conversation_members m
    WHERE m.organization_conversation_id = NEW.organization_conversation_id
      AND m.user_id != NEW.sender_id
  LOOP
    SELECT up.expo_push_token INTO v_token
    FROM user_profiles up
    WHERE up.id = v_member.user_id
      AND up.expo_push_token IS NOT NULL
      AND up.expo_push_token != ''
      AND (up.push_notifications IS NULL OR up.push_notifications = true);

    IF v_token IS NOT NULL THEN
      INSERT INTO public.message_push_queue (expo_push_token, title, body, data)
      VALUES (
        v_token,
        v_sender_name,
        v_body,
        jsonb_build_object(
          'type', 'message',
          'conversation_id', NEW.organization_conversation_id,
          'conversation_type', 'organization'
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 6. Trigger on direct messages
DROP TRIGGER IF EXISTS trigger_notify_new_direct_message ON public.messages;
CREATE TRIGGER trigger_notify_new_direct_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_direct_message();

-- 7. Trigger on organization messages
DROP TRIGGER IF EXISTS trigger_notify_new_organization_message ON public.organization_messages;
CREATE TRIGGER trigger_notify_new_organization_message
  AFTER INSERT ON public.organization_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_organization_message();

-- 8. Call edge function when a row is added to message_push_queue (requires pg_net)
--    The edge function must accept POST body: { "expo_push_token", "title", "body", "data" }
--    and send to Expo Push API.
CREATE OR REPLACE FUNCTION public.send_message_push_via_edge_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_body jsonb;
BEGIN
  SELECT value INTO v_url FROM app_settings WHERE key = 'supabase_functions_url';
  IF v_url IS NULL OR v_url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1' THEN
    RAISE WARNING 'message_push: Update app_settings.supabase_functions_url with your project ref';
    RETURN NEW;
  END IF;

  v_body := jsonb_build_object(
    'expo_push_token', NEW.expo_push_token,
    'title', NEW.title,
    'body', COALESCE(NEW.body, ''),
    'data', COALESCE(NEW.data, '{}')
  );

  PERFORM net.http_post(
    url := v_url || '/send-push-notification',
    body := v_body,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_send_message_push ON public.message_push_queue;
CREATE TRIGGER trigger_send_message_push
  AFTER INSERT ON public.message_push_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.send_message_push_via_edge_function();

-- =============================================================================
-- Required schema (if not already present):
--   user_profiles: expo_push_token (text), push_notifications (boolean, optional)
--   messages: conversation_id, sender_id, participant1_id, participant2_id, content
--   organization_messages: organization_conversation_id, sender_id, content
--   organization_conversation_members: organization_conversation_id, user_id
-- =============================================================================
-- After running, update your project URL:
--   UPDATE app_settings SET value = 'https://YOUR_ACTUAL_REF.supabase.co/functions/v1' WHERE key = 'supabase_functions_url';
-- =============================================================================
