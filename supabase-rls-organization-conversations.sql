-- Optional: only needed if not using create_organization_group_conversation RPC.
-- The app creates group conversations via supabase.rpc('create_organization_group_conversation', ...).
--
-- If you ever need direct INSERT from the client, run this in Supabase Dashboard → SQL Editor.

-- 1. Allow authenticated users who are active members of the organization to INSERT
--    a new row in organization_conversations (for that organization_id).
CREATE POLICY "Allow org members to create organization_conversations"
ON public.organization_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.organization_id = organization_conversations.organization_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  )
);

-- 2. Allow inserting into organization_conversation_members when the user
--    created the conversation (created_by = auth.uid()) or is an active member
--    of that organization (so they can add members).
CREATE POLICY "Allow creator or org member to add conversation members"
ON public.organization_conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_conversations oc
    LEFT JOIN public.memberships m
      ON m.organization_id = oc.organization_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
    WHERE oc.id = organization_conversation_members.organization_conversation_id
      AND (oc.created_by = auth.uid() OR m.user_id IS NOT NULL)
  )
);

-- 3. Group chat menu: leave (delete own membership) or creator removes another member.
-- Run in Supabase Dashboard → SQL Editor if your RLS doesn't yet allow these.
CREATE POLICY "Allow leave or creator remove from organization_conversation_members"
ON public.organization_conversation_members
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_conversations oc
    WHERE oc.id = organization_conversation_members.organization_conversation_id
      AND oc.created_by = auth.uid()
  )
);

-- 4. Group chat menu: creator can update conversation (e.g. name).
CREATE POLICY "Allow creator to update organization_conversation"
ON public.organization_conversations
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
