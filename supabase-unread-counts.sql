-- Unread message counts per conversation and total (for list badges + tab badge).
-- Run in Supabase Dashboard → SQL Editor.
-- Unread = messages from others where created_at > last_read_at (or no read state = all from others).
-- 1) Create the read-state table if it doesn't exist (required for marking conversations as read):
CREATE TABLE IF NOT EXISTS public.conversation_read_states (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_type text NOT NULL,
  conversation_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_type, conversation_id)
);

-- 2) Function used by the app to fetch unread counts (parameter: p_user_id):
CREATE OR REPLACE FUNCTION public.get_conversation_unread_counts(p_user_id uuid)
RETURNS TABLE (
  conversation_type text,
  conversation_id uuid,
  unread_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direct: conversations where user is participant; count messages from the other participant after last_read_at
  RETURN QUERY
  SELECT
    'direct'::text,
    c.id,
    COUNT(m.id)::bigint
  FROM conversations c
  LEFT JOIN conversation_read_states r
    ON r.user_id = p_user_id
   AND r.conversation_type = 'direct'
   AND r.conversation_id = c.id
  LEFT JOIN messages m
    ON m.conversation_id = c.id
   AND m.sender_id != p_user_id
   AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
  WHERE c.participant1_id = p_user_id OR c.participant2_id = p_user_id
  GROUP BY c.id
  HAVING COUNT(m.id) > 0;

  -- Organization: conversations where user is member; count messages from others after last_read_at
  RETURN QUERY
  SELECT
    'organization'::text,
    oc.id,
    COUNT(om.id)::bigint
  FROM organization_conversations oc
  LEFT JOIN conversation_read_states r
    ON r.user_id = p_user_id
   AND r.conversation_type = 'organization'
   AND r.conversation_id = oc.id
  LEFT JOIN organization_messages om
    ON om.organization_conversation_id = oc.id
   AND om.sender_id != p_user_id
   AND (r.last_read_at IS NULL OR om.created_at > r.last_read_at)
  WHERE oc.id IN (
    SELECT organization_conversation_id
    FROM organization_conversation_members
    WHERE user_id = p_user_id
  )
  GROUP BY oc.id
  HAVING COUNT(om.id) > 0;
END;
$$;
