import {
  Conversation,
  Message,
  OrganizationConversation,
  OrganizationMessage,
} from '../../types/database';
import { supabase } from '../supabase';

// --- 1:1 conversations (conversations + messages) ---

/** Returns user IDs that are members of the organization (for filtering direct convos by org). */
export async function getOrganizationMemberUserIds(organizationId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .not('user_id', 'is', null);

  if (error) {
    console.error('Error fetching organization member ids:', error);
    return new Set();
  }
  return new Set((data || []).map((r) => r.user_id as string));
}

export async function getConversationsForUser(userId: string): Promise<
  (Conversation & {
    other_user?: { id: string; first_name: string | null; last_name: string | null; profile_image_url: string | null } | null;
    listing?: { id: string; title: string; image_url: string | null } | null;
  })[]
> {
  const { data: convos, error } = await supabase
    .from('conversations')
    .select(`
      *,
      listing:listings (
        id,
        title,
        listing_images (
          path,
          bucket
        )
      )
    `)
    .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }

  const list = (convos || []) as any[];
  const otherIds = [...new Set(list.map((c) => (c.participant1_id === userId ? c.participant2_id : c.participant1_id)))];
  
  // Process listings to get the first image URL if available
  const processedList = await Promise.all(list.map(async (c) => {
    let listingData = null;
    if (c.listing) {
      const images = c.listing.listing_images;
      const imagePath = images && images.length > 0 ? images[0].path : null;
      const bucket = images && images.length > 0 ? images[0].bucket : 'listing_images';
      
      let imageUrl = null;
      if (imagePath) {
         try {
           const { data } = await supabase.storage.from(bucket).createSignedUrl(imagePath, 3600);
           imageUrl = data?.signedUrl || null;
         } catch (e) {
           console.warn('Error signing listing image URL:', e);
         }
      }
      
      listingData = {
        id: c.listing.id,
        title: c.listing.title,
        image_url: imageUrl
      };
    }
    return { ...c, listing: listingData };
  }));

  if (otherIds.length === 0) return processedList.map((c) => ({ ...c, other_user: null }));

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, profile_image_url')
    .in('id', otherIds);
  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, { id: p.id, first_name: p.first_name, last_name: p.last_name, profile_image_url: p.profile_image_url ?? null }])
  );

  return processedList.map((c) => {
    const otherId = c.participant1_id === userId ? c.participant2_id : c.participant1_id;
    return { ...c, other_user: profileMap.get(otherId) ?? null };
  });
}

export type DirectConversationHeader = {
  name: string;
  profileImageUrl: string | null;
  listing?: { id: string; title: string; image_url: string | null } | null;
};

export async function getDirectConversationHeader(
  conversationId: string,
  currentUserId: string
): Promise<DirectConversationHeader | null> {
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select(`
      participant1_id, 
      participant2_id,
      listing:listings (
        id,
        title,
        listing_images (
          path,
          bucket
        )
      )
    `)
    .eq('id', conversationId)
    .maybeSingle();

  if (convError || !conv) return null;
  const otherUserId = conv.participant1_id === currentUserId ? conv.participant2_id : conv.participant1_id;

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, profile_image_url')
    .eq('id', otherUserId)
    .maybeSingle();

  if (profileError || !profile) return null;
  const first = profile.first_name?.trim() || '';
  const last = profile.last_name?.trim() || '';
  const name = [first, last].filter(Boolean).join(' ') || 'Okänd';

  let listingData = null;
  const convData = conv as any;
  if (convData.listing) {
    const images = convData.listing.listing_images;
    const imagePath = images && images.length > 0 ? images[0].path : null;
    const bucket = images && images.length > 0 ? images[0].bucket : 'listing_images';
    
    let imageUrl = null;
    if (imagePath) {
       try {
         const { data } = await supabase.storage.from(bucket).createSignedUrl(imagePath, 3600);
         imageUrl = data?.signedUrl || null;
       } catch (e) {
         console.warn('Error signing listing image URL:', e);
       }
    }
    
    listingData = {
      id: convData.listing.id,
      title: convData.listing.title,
      image_url: imageUrl
    };
  }

  return { name, profileImageUrl: profile.profile_image_url ?? null, listing: listingData };
}

export type OrganizationConversationInfo = {
  name: string;
  created_by: string | null;
};

export async function getOrganizationConversationById(
  conversationId: string
): Promise<OrganizationConversationInfo | null> {
  const { data, error } = await supabase
    .from('organization_conversations')
    .select('name, created_by')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !data) return null;
  return { name: data.name || 'Grupp', created_by: data.created_by ?? null };
}

export type OrganizationConversationMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
};

export async function getOrganizationConversationMembers(
  conversationId: string
): Promise<OrganizationConversationMember[]> {
  const { data: rows, error } = await supabase
    .from('organization_conversation_members')
    .select('user_id')
    .eq('organization_conversation_id', conversationId);

  if (error || !rows?.length) return [];

  const userIds = [...new Set((rows as { user_id: string }[]).map((r) => r.user_id))];
  const { data: profiles, error: profError } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, profile_image_url')
    .in('id', userIds);

  if (profError || !profiles?.length) return [];
  return profiles.map((p) => ({
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    profile_image_url: p.profile_image_url ?? null,
  }));
}

export async function leaveOrganizationConversation(
  userId: string,
  conversationId: string
): Promise<void> {
  const { error } = await supabase
    .from('organization_conversation_members')
    .delete()
    .eq('organization_conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error leaving organization conversation:', error);
    throw error;
  }
}

export async function removeMemberFromOrganizationConversation(
  conversationId: string,
  memberUserId: string
): Promise<void> {
  const { error } = await supabase
    .from('organization_conversation_members')
    .delete()
    .eq('organization_conversation_id', conversationId)
    .eq('user_id', memberUserId);

  if (error) {
    console.error('Error removing member from organization conversation:', error);
    throw error;
  }
}

export async function updateOrganizationConversationName(
  conversationId: string,
  name: string
): Promise<void> {
  const { error } = await supabase
    .from('organization_conversations')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) {
    console.error('Error updating organization conversation name:', error);
    throw error;
  }
}

/** Get or create a 1:1 conversation between two user IDs (auth user ids). */
export async function getOrCreateConversation(
  userId: string,
  otherUserId: string
): Promise<Conversation> {
  const id1 = userId < otherUserId ? userId : otherUserId;
  const id2 = userId < otherUserId ? otherUserId : userId;

  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('participant1_id', id1)
    .eq('participant2_id', id2)
    .maybeSingle();

  if (existing) return existing as Conversation;

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ participant1_id: id1, participant2_id: id2 })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
  return created as Conversation;
}

export async function getMessages(conversationId: string): Promise<
  (Message & { sender?: { first_name: string | null; last_name: string | null } | null })[]
> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  const list = (messages || []) as Message[];
  const senderIds = [...new Set(list.map((m) => m.sender_id))];
  if (senderIds.length === 0) return list.map((m) => ({ ...m, sender: null }));

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name')
    .in('id', senderIds);
  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, { first_name: p.first_name, last_name: p.last_name }])
  );

  return list.map((m) => ({
    ...m,
    sender: profileMap.get(m.sender_id) ?? null,
  }));
}

export type MessageImage = {
  bucket: string;
  path: string;
  fileName: string;
};

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  image?: MessageImage
): Promise<Message> {
  const insertPayload: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: senderId,
    content: content || '',
  };
  if (image) {
    insertPayload.image_bucket = image.bucket;
    insertPayload.image_path = image.path;
    insertPayload.image_file_name = image.fileName;
  }

  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert(insertPayload)
    .select()
    .single();

  if (msgError) {
    console.error('Error sending message:', msgError);
    throw msgError;
  }

  const preview = content.trim() || (image ? '[Bild]' : '');
  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      last_message: preview,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (updateError) console.warn('Failed to update conversation last_message:', updateError);

  return msg as Message;
}

// --- Organization / group conversations (organization_conversations table) ---
// Group chats use: organization_conversations, organization_messages, organization_conversation_members.
// Membership is in organization_conversation_members (user_id = user_profiles.id).

/** Only the two default org chat types are pinned (Alla medlemmar, Styrelse & admin). */
const PINNED_ORG_CONVERSATION_TYPES = ['all_members', 'board_admin'];

/** Fetches only the two pinned org conversations: Alla medlemmar (all_members) and Styrelse & admin (board_admin). Other groups (e.g. user-created) are not pinned. */
export async function getPinnedOrganizationConversations(
  organizationId: string
): Promise<OrganizationConversation[]> {
  const { data, error } = await supabase
    .from('organization_conversations')
    .select('*')
    .eq('organization_id', organizationId)
    .in('type', PINNED_ORG_CONVERSATION_TYPES);

  if (error) {
    console.error('Error fetching pinned organization conversations:', error);
    throw error;
  }

  const list = (data || []) as OrganizationConversation[];
  // Order: all_members first, then board_admin
  return list.sort((a, b) => {
    if (a.type === 'all_members' && b.type !== 'all_members') return -1;
    if (a.type !== 'all_members' && b.type === 'all_members') return 1;
    return 0;
  });
}

export async function getOrganizationConversationsForUser(
  organizationId: string,
  userId: string
): Promise<
  (OrganizationConversation & {
    unread_count?: number;
  })[]
> {
  // user_id in organization_conversation_members is user_profiles.id (same as auth user id)
  const { data: memberRows, error: memberError } = await supabase
    .from('organization_conversation_members')
    .select('organization_conversation_id')
    .eq('user_id', userId);

  if (memberError || !memberRows?.length) {
    return [];
  }

  const convIds = memberRows.map((r) => r.organization_conversation_id);
  const { data, error } = await supabase
    .from('organization_conversations')
    .select('*')
    .eq('organization_id', organizationId)
    .in('id', convIds)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching organization conversations:', error);
    throw error;
  }

  return (data || []) as OrganizationConversation[];
}

export async function getOrganizationMessages(
  organizationConversationId: string
): Promise<
  (OrganizationMessage & { sender?: { first_name: string | null; last_name: string | null } | null })[]
> {
  const { data, error } = await supabase
    .from('organization_messages')
    .select(
      `
      *,
      sender:user_profiles!organization_messages_sender_id_fkey(first_name, last_name)
    `
    )
    .eq('organization_conversation_id', organizationConversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching organization messages:', error);
    throw error;
  }

  const withSender = (data || []).map((m) => {
    const { sender, ...rest } = m as OrganizationMessage & {
      sender?: { first_name: string | null; last_name: string | null };
    };
    return { ...rest, sender: sender ?? null };
  });
  return withSender;
}

export async function sendOrganizationMessage(
  organizationConversationId: string,
  senderId: string,
  content: string,
  image?: MessageImage
): Promise<OrganizationMessage> {
  const insertPayload: Record<string, unknown> = {
    organization_conversation_id: organizationConversationId,
    sender_id: senderId,
    content: content || '',
  };
  if (image) {
    insertPayload.image_bucket = image.bucket;
    insertPayload.image_path = image.path;
    insertPayload.image_file_name = image.fileName;
  }

  const { data: msg, error: msgError } = await supabase
    .from('organization_messages')
    .insert(insertPayload)
    .select()
    .single();

  if (msgError) {
    console.error('Error sending organization message:', msgError);
    throw msgError;
  }

  const preview = content.trim() || (image ? '[Bild]' : '');
  const { error: updateError } = await supabase
    .from('organization_conversations')
    .update({
      last_message: preview,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationConversationId);

  if (updateError) console.warn('Failed to update org conversation last_message:', updateError);

  return msg as OrganizationMessage;
}

/** Org member with profile for new conversation picker (1:1 or group). */
export type OrgMemberForPicker = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
};

export async function getOrganizationMembersForNewConversation(
  organizationId: string
): Promise<OrgMemberForPicker[]> {
  const { data: memberships, error: memError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .not('user_id', 'is', null);

  if (memError || !memberships?.length) {
    if (memError) console.error('Error fetching memberships for new conversation:', memError);
    return [];
  }

  const userIds = [...new Set(memberships.map((m) => m.user_id as string))];
  const { data: profiles, error: profError } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, profile_image_url')
    .in('id', userIds);

  if (profError) {
    console.error('Error fetching user profiles for new conversation:', profError);
    throw profError;
  }

  return (profiles || []).map((p) => ({
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    profile_image_url: p.profile_image_url ?? null,
  }));
}

export async function getOrganizationGroups(
  organizationId: string
): Promise<OrganizationConversation[]> {
  const { data, error } = await supabase
    .from('organization_conversations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('type', 'group')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching organization groups:', error);
    throw error;
  }

  return (data || []) as OrganizationConversation[];
}

export async function createOrganizationConversation(
  organizationId: string,
  name: string,
  memberUserIds: string[]
): Promise<OrganizationConversation> {
  const { data: conv, error } = await supabase.rpc('create_organization_group_conversation', {
    p_organization_id: organizationId,
    p_name: name.trim(),
    p_member_ids: memberUserIds,
  });

  if (error) {
    console.error('Error creating organization conversation:', error);
    throw error;
  }

  return conv as OrganizationConversation;
}

// --- Read state (per-message read receipts: message_read_receipts + RPCs) ---

/**
 * Mark all messages in a conversation as read for the current user.
 * Uses RPC mark_conversation_messages_read (inserts into message_read_receipts).
 * Call when the user opens/focuses the conversation, or when a new message arrives in the open thread.
 */
export async function markConversationMessagesRead(
  conversationId: string,
  conversationType: 'direct' | 'org'
): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_messages_read', {
    p_conversation_id: conversationId,
    p_conversation_type: conversationType,
  });
  if (error) console.warn('Failed to mark conversation messages read:', error);
}

export type UnreadCountsResult = {
  counts: Map<string, number>;
  total: number;
};

type UnreadRow = {
  conversation_type?: string;
  conversation_id?: string;
  unread_count?: number;
};

/** Backend returns conversation_type 'direct' | 'org'; we use keys 'direct-{id}' | 'organization-{id}'. */
function parseUnreadRows(data: unknown): UnreadCountsResult {
  const rows = (Array.isArray(data) ? data : []) as UnreadRow[];
  const counts = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const convType = row.conversation_type ?? '';
    const convId = row.conversation_id ?? '';
    const n = Number(row.unread_count ?? 0) || 0;
    if (convType && convId) {
      const appType = convType === 'org' ? 'organization' : convType;
      const key = `${appType}-${convId}`;
      counts.set(key, n);
      total += n;
    }
  }
  return { counts, total };
}

/**
 * Get per-conversation unread counts for the current user in the given organization.
 * Uses RPC get_conversation_unread_counts(p_organization_id).
 * Returns keys "direct-{id}" and "organization-{id}".
 */
export async function getConversationUnreadCounts(
  _userId: string,
  organizationId: string | null | undefined
): Promise<UnreadCountsResult> {
  if (!organizationId) {
    return { counts: new Map(), total: 0 };
  }
  const { data, error } = await supabase.rpc('get_conversation_unread_counts', {
    p_organization_id: organizationId,
  });
  if (error) {
    console.warn('Unread counts:', error.message);
    return { counts: new Map(), total: 0 };
  }
  if (data == null) return { counts: new Map(), total: 0 };
  return parseUnreadRows(data);
}
