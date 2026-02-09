import { supabase } from '../supabase';

// ── Types ──

export type MemberProfile = {
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  profile_image_url: string | null;
  email: string | null;
};

export type OrganizationMember = {
  id: string; // membership id
  user_id: string | null;
  organization_id: string;
  role: string;
  board_title: string | null;
  status: string;
  invited_email: string | null;
  joined_at: string | null;
  ended_at?: string | null;
  profile: MemberProfile | null;
};

export type MemberCategory = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type CategoryAssignment = {
  id: string;
  membership_id: string;
  category_id: string;
};

// ── Fetch members (admin/styrelse) ──

export async function getOrganizationMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const { data, error } = await supabase.rpc('get_organization_members', {
    org_id: organizationId,
  });

  if (error) {
    console.error('Error fetching organization members:', error);
    return [];
  }

  const members = (data || []).map((m: any) => {
    let profile: MemberProfile | null = null;
    const raw = m.user_profiles;
    if (raw) {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      profile = {
        first_name: p?.first_name || null,
        last_name: p?.last_name || null,
        phone_number: p?.phone_number || null,
        profile_image_url: p?.profile_image_url || null,
        email: p?.email || m.email || null,
      };
    }

    return {
      id: m.id,
      user_id: m.user_id,
      organization_id: m.organization_id,
      role: m.role,
      board_title: m.board_title,
      status: m.status,
      invited_email: m.invited_email,
      joined_at: m.joined_at,
      ended_at: m.ended_at ?? null,
      profile,
    };
  });

  // Fallback: for members that have a user_id but no name in their profile,
  // fetch user_profiles directly to fill in the gaps.
  const missingProfileUserIds = members
    .filter(
      (m) =>
        m.user_id &&
        (!m.profile || (!m.profile.first_name && !m.profile.last_name))
    )
    .map((m) => m.user_id!)
    .filter((id) => !!id);

  if (missingProfileUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, phone_number, profile_image_url')
      .in('id', missingProfileUserIds);

    if (profiles) {
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      for (const member of members) {
        if (member.user_id && profileMap.has(member.user_id)) {
          const p = profileMap.get(member.user_id)!;
          member.profile = {
            first_name: p.first_name,
            last_name: p.last_name,
            phone_number: p.phone_number,
            profile_image_url: p.profile_image_url,
            email: member.profile?.email || member.invited_email || null,
          };
        }
      }
    }
  }

  return members;
}

// ── Fetch active members only (normal members) ──

export async function getActiveMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });

  if (error || !memberships) {
    console.error('Error fetching active members:', error);
    return [];
  }

  const userIds = memberships
    .map((m) => m.user_id)
    .filter((id): id is string => !!id);

  let profileMap = new Map<string, MemberProfile>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, phone_number, profile_image_url')
      .in('id', userIds);

    if (profiles) {
      for (const p of profiles) {
        profileMap.set(p.id, {
          first_name: p.first_name,
          last_name: p.last_name,
          phone_number: p.phone_number,
          profile_image_url: p.profile_image_url,
          email: null,
        });
      }
    }

    // Also get emails from auth metadata (user_profiles don't have email)
    // We'll use invited_email as fallback
  }

  return memberships.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    organization_id: m.organization_id!,
    role: m.role,
    board_title: m.board_title,
    status: m.status || 'active',
    invited_email: m.invited_email,
    joined_at: m.joined_at,
    ended_at: m.ended_at ?? null,
    profile: m.user_id ? profileMap.get(m.user_id) || null : null,
  }));
}

// ── Categories (groups) ──

export async function getMemberCategories(
  organizationId: string
): Promise<MemberCategory[]> {
  const { data, error } = await supabase
    .from('member_categories')
    .select('*')
    .eq('organization_id', organizationId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching member categories:', error);
    return [];
  }
  return data || [];
}

export async function getCategoryAssignments(
  organizationId: string
): Promise<CategoryAssignment[]> {
  const { data, error } = await supabase
    .from('member_category_assignments')
    .select('id, membership_id, category_id, member_categories!inner(organization_id)')
    .eq('member_categories.organization_id', organizationId);

  if (error) {
    console.error('Error fetching category assignments:', error);
    return [];
  }

  return (data || []).map((d: any) => ({
    id: d.id,
    membership_id: d.membership_id,
    category_id: d.category_id,
  }));
}

// ── Invite ──

export async function inviteMember(
  organizationId: string,
  email: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  // Check for duplicate invite
  const { data: existing } = await supabase
    .from('memberships')
    .select('id, status')
    .eq('organization_id', organizationId)
    .eq('invited_email', email)
    .in('status', ['invited', 'active']);

  if (existing && existing.length > 0) {
    const hasActive = existing.some((m) => m.status === 'active');
    if (hasActive) return { success: false, error: 'Denna e-postadress är redan en aktiv medlem.' };
    return { success: false, error: 'En inbjudan har redan skickats till denna e-postadress.' };
  }

  const { error } = await supabase.from('memberships').insert({
    organization_id: organizationId,
    role,
    status: 'invited',
    invited_email: email,
  });

  if (error) {
    console.error('Error inviting member:', error);
    return { success: false, error: 'Kunde inte skapa inbjudan.' };
  }

  return { success: true };
}

// ── Update member ──

export async function updateMemberRole(
  membershipId: string,
  role: string,
  boardTitle: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('memberships')
    .update({ role, board_title: boardTitle })
    .eq('id', membershipId);

  if (error) {
    console.error('Error updating member role:', error);
    return false;
  }
  return true;
}

// ── Update category assignments ──

export async function updateCategoryAssignments(
  membershipId: string,
  selectedCategoryIds: string[],
  currentAssignments: CategoryAssignment[]
): Promise<boolean> {
  const currentIds = currentAssignments
    .filter((a) => a.membership_id === membershipId)
    .map((a) => a.category_id);

  const toAdd = selectedCategoryIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentAssignments.filter(
    (a) => a.membership_id === membershipId && !selectedCategoryIds.includes(a.category_id)
  );

  // Remove
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('member_category_assignments')
      .delete()
      .in(
        'id',
        toRemove.map((a) => a.id)
      );
    if (error) {
      console.error('Error removing category assignments:', error);
      return false;
    }
  }

  // Add
  if (toAdd.length > 0) {
    const { error } = await supabase.from('member_category_assignments').insert(
      toAdd.map((categoryId) => ({
        membership_id: membershipId,
        category_id: categoryId,
      }))
    );
    if (error) {
      console.error('Error adding category assignments:', error);
      return false;
    }
  }

  return true;
}

// ── Remove / end membership ──

export async function removeMember(membershipId: string): Promise<boolean> {
  const { error } = await supabase
    .from('memberships')
    .update({ status: 'removed', ended_at: new Date().toISOString() })
    .eq('id', membershipId);

  if (error) {
    console.error('Error removing member:', error);
    return false;
  }
  return true;
}

export async function deleteInvitation(membershipId: string): Promise<boolean> {
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('id', membershipId)
    .eq('status', 'invited');

  if (error) {
    console.error('Error deleting invitation:', error);
    return false;
  }
  return true;
}

// ── Create / update / delete categories ──

export async function createCategory(
  organizationId: string,
  name: string,
  description: string | null,
  color: string
): Promise<MemberCategory | null> {
  const { data, error } = await supabase
    .from('member_categories')
    .insert({ organization_id: organizationId, name, description, color })
    .select()
    .single();

  if (error) {
    console.error('Error creating category:', error);
    return null;
  }
  return data;
}

export async function updateCategory(
  categoryId: string,
  name: string,
  description: string | null,
  color: string
): Promise<boolean> {
  const { error } = await supabase
    .from('member_categories')
    .update({ name, description, color })
    .eq('id', categoryId);

  if (error) {
    console.error('Error updating category:', error);
    return false;
  }
  return true;
}

export async function deleteCategory(categoryId: string): Promise<boolean> {
  const { error } = await supabase
    .from('member_categories')
    .delete()
    .eq('id', categoryId);

  if (error) {
    console.error('Error deleting category:', error);
    return false;
  }
  return true;
}

// ── Sign profile image URL ──

export async function signProfileImageUrl(
  url: string | null
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('http')) return url;

  try {
    const { data } = await supabase.storage
      .from('profile-images')
      .createSignedUrl(url, 3600);
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}
