import { supabase } from '../supabase';

export const getOrganizationEvents = async (organizationId: string) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', organizationId)
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    throw error;
  }

  return data || [];
};

export const getUpcomingEvents = async (organizationId: string, limit?: number) => {
  const today = new Date().toISOString().split('T')[0];
  
  let query = supabase
    .from('events')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('event_date', today)
    .order('event_date', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching upcoming events:', error);
    throw error;
  }

  return data || [];
};

export const getMeetingAgenda = async (eventId: string) => {
  const { data, error } = await supabase
    .from('meeting_agenda')
    .select('*')
    .eq('event_id', eventId)
    .order('item_order');

  if (error) {
    console.error('Error fetching meeting agenda:', error);
    return [];
  }

  return data || [];
};

export const getMeetingDocuments = async (eventId: string) => {
  const { data, error } = await supabase
    .from('meeting_documents')
    .select(`
      *,
      documents (*)
    `)
    .eq('event_id', eventId);

  if (error) {
    console.error('Error fetching meeting documents:', error);
    return [];
  }

  return data || [];
};

export const getMeetingNotes = async (eventId: string) => {
  const { data, error } = await supabase
    .from('meeting_notes')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    console.error('Error fetching meeting notes:', error);
    return null;
  }

  return data;
};

export const getEventAttendanceWithMembers = async (eventId: string, organizationId: string) => {
  console.log('Fetching attendance for event:', eventId);
  
  // Fetch active members with their profiles using a direct query
  // (accessible to all authenticated members, unlike the admin-only RPC)
  const { data: members, error: membersError } = await supabase
    .from('memberships')
    .select('user_id, role, board_title, user_profiles:user_id(first_name, last_name)')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .not('user_id', 'is', null);

  if (membersError) {
    console.error('Error fetching organization members:', membersError);
    return [];
  }

  // Then get existing attendance records
  const { data: attendance, error: attendanceError } = await supabase
    .from('meeting_attendance')
    .select('*')
    .eq('event_id', eventId);

  if (attendanceError) {
    console.error('Error fetching attendance records:', attendanceError);
  }

  // Combine the data
  const attendanceMap = new Map();
  (attendance || []).forEach(record => {
    attendanceMap.set(record.user_id, record);
  });

  const result = (members || []).map((member: any) => {
    const userProfiles = member.user_profiles;
    const attendanceRecord = attendanceMap.get(member.user_id);
    
    return {
      id: attendanceRecord?.id || `temp-${member.user_id}`,
      event_id: eventId,
      user_id: member.user_id,
      status: attendanceRecord?.status || null,
      comment: attendanceRecord?.comment || null,
      created_at: attendanceRecord?.created_at || null,
      updated_at: attendanceRecord?.updated_at || null,
      user_profiles: userProfiles ? {
        first_name: userProfiles.first_name,
        last_name: userProfiles.last_name
      } : null,
      memberships: {
        board_title: member.board_title,
        role: member.role
      }
    };
  });

  console.log('Combined attendance data:', result);
  return result;
};

export const getMeetingAttendance = async (eventId: string) => {
  console.log('Fetching attendance for event:', eventId);
  
  const { data, error } = await supabase
    .from('meeting_attendance')
    .select('*')
    .eq('event_id', eventId);

  if (error) {
    console.error('Error fetching meeting attendance:', error);
    return [];
  }

  console.log('Attendance data received:', data);
  return data || [];
};

export const getMeetingRoles = async (eventId: string) => {
  const { data, error } = await supabase
    .from('meeting_roles')
    .select('*')
    .eq('event_id', eventId);

  if (error) {
    console.error('Error fetching meeting roles:', error);
    return [];
  }

  return data || [];
};

// Attendance management functions
export const getUserAttendanceStatus = async (eventId: string, userId: string) => {
  const { data, error } = await supabase
    .from('meeting_attendance')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user attendance:', error);
    return null;
  }

  return data;
};

export const updateAttendanceStatus = async (eventId: string, userId: string, status: 'attending' | 'not_attending', comment?: string) => {
  // First check if attendance record exists
  const existingAttendance = await getUserAttendanceStatus(eventId, userId);

  if (existingAttendance) {
    // Update existing record
    const { data, error } = await supabase
      .from('meeting_attendance')
      .update({ status, comment, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating attendance:', error);
      throw error;
    }

    return data;
  } else {
    // Create new record
    const { data, error } = await supabase
      .from('meeting_attendance')
      .insert({
        event_id: eventId,
        user_id: userId,
        status,
        comment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating attendance:', error);
      throw error;
    }

    return data;
  }
};

export const getMeetingDetails = async (eventId: string) => {
  try {
    const [agenda, documents, notes, roles] = await Promise.all([
      getMeetingAgenda(eventId),
      getMeetingDocuments(eventId),
      getMeetingNotes(eventId),
      getMeetingRoles(eventId),
    ]);

    return {
      agenda,
      documents,
      notes,
      attendance: [], // Empty array since we use getEventAttendanceWithMembers separately
      roles,
    };
  } catch (error) {
    console.error('Error fetching meeting details:', error);
    // Return empty data structure instead of throwing
    return {
      agenda: [],
      documents: [],
      notes: null,
      attendance: [],
      roles: [],
    };
  }
}; 