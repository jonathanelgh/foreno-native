export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      documents: {
        Row: {
          category: string | null
          description: string | null
          event_id: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          organization_id: string | null
          title: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          event_id?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          organization_id?: string | null
          title?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          description?: string | null
          event_id?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          organization_id?: string | null
          title?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string | null
          id: string
          location: string | null
          mandatory_for: string[] | null
          organization_id: string | null
          start_time: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          location?: string | null
          mandatory_for?: string[] | null
          organization_id?: string | null
          start_time?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          location?: string | null
          mandatory_for?: string[] | null
          organization_id?: string | null
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_assignments: {
        Row: {
          fee_id: string | null
          id: string
          membership_id: string | null
        }
        Insert: {
          fee_id?: string | null
          id?: string
          membership_id?: string | null
        }
        Update: {
          fee_id?: string | null
          id?: string
          membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_assignments_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          due_date: string | null
          fee_id: string | null
          id: string
          membership_id: string | null
          notes: string | null
          paid_date: string | null
          status: string
        }
        Insert: {
          due_date?: string | null
          fee_id?: string | null
          id?: string
          membership_id?: string | null
          notes?: string | null
          paid_date?: string | null
          status: string
        }
        Update: {
          due_date?: string | null
          fee_id?: string | null
          id?: string
          membership_id?: string | null
          notes?: string | null
          paid_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          amount: number
          applies_to_all: boolean | null
          created_at: string | null
          created_by: string | null
          frequency: string | null
          id: string
          organization_id: string | null
          start_date: string | null
          title: string
        }
        Insert: {
          amount: number
          applies_to_all?: boolean | null
          created_at?: string | null
          created_by?: string | null
          frequency?: string | null
          id?: string
          organization_id?: string | null
          start_date?: string | null
          title: string
        }
        Update: {
          amount?: number
          applies_to_all?: boolean | null
          created_at?: string | null
          created_by?: string | null
          frequency?: string | null
          id?: string
          organization_id?: string | null
          start_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agenda: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          event_id: string
          id: string
          is_completed: boolean | null
          is_meeting_opened: boolean | null
          item_order: number
          meeting_opened_at: string | null
          meeting_opened_by: string | null
          parent_item_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          event_id: string
          id?: string
          is_completed?: boolean | null
          is_meeting_opened?: boolean | null
          item_order: number
          meeting_opened_at?: string | null
          meeting_opened_by?: string | null
          parent_item_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          event_id?: string
          id?: string
          is_completed?: boolean | null
          is_meeting_opened?: boolean | null
          item_order?: number
          meeting_opened_at?: string | null
          meeting_opened_by?: string | null
          parent_item_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_agenda_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendance: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_documents: {
        Row: {
          created_at: string | null
          document_id: string
          event_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          event_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          event_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          event_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          event_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_roles: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          board_title: string | null
          ended_at: string | null
          id: string
          invited_email: string | null
          joined_at: string | null
          organization_id: string | null
          role: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          board_title?: string | null
          ended_at?: string | null
          id?: string
          invited_email?: string | null
          joined_at?: string | null
          organization_id?: string | null
          role: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          board_title?: string | null
          ended_at?: string | null
          id?: string
          invited_email?: string | null
          joined_at?: string | null
          organization_id?: string | null
          role?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          billing_address: string | null
          billing_city: string | null
          billing_postal_code: string | null
          city: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          location: string | null
          logo_url: string | null
          name: string
          organization_number: string | null
          postal_code: string | null
          same_billing_address: boolean | null
          type: string | null
        }
        Insert: {
          address?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          organization_number?: string | null
          postal_code?: string | null
          same_billing_address?: boolean | null
          type?: string | null
        }
        Update: {
          address?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          organization_number?: string | null
          postal_code?: string | null
          same_billing_address?: boolean | null
          type?: string | null
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          id: string
          membership_id: string | null
          poll_id: string | null
          selected_option: string | null
          voted_at: string | null
        }
        Insert: {
          id?: string
          membership_id?: string | null
          poll_id?: string | null
          selected_option?: string | null
          voted_at?: string | null
        }
        Update: {
          id?: string
          membership_id?: string | null
          poll_id?: string | null
          selected_option?: string | null
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_by: string | null
          expires_at: string | null
          id: string
          options: string[] | null
          organization_id: string | null
          question: string | null
          visible_to: string[] | null
        }
        Insert: {
          created_by?: string | null
          expires_at?: string | null
          id?: string
          options?: string[] | null
          organization_id?: string | null
          question?: string | null
          visible_to?: string[] | null
        }
        Update: {
          created_by?: string | null
          expires_at?: string | null
          id?: string
          options?: string[] | null
          organization_id?: string | null
          question?: string | null
          visible_to?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          active_organization_id: string | null
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          active_organization_id?: string | null
          created_at?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          active_organization_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone_number: string | null
          profile_image_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone_number?: string | null
          profile_image_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone_number?: string | null
          profile_image_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      utskick: {
        Row: {
          content: string | null
          document_id: string | null
          file_name: string | null
          file_url: string | null
          id: string
          image_url: string | null
          organization_id: string | null
          poll_id: string | null
          published_at: string | null
          published_by: string | null
          title: string | null
        }
        Insert: {
          content?: string | null
          document_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          organization_id?: string | null
          poll_id?: string | null
          published_at?: string | null
          published_by?: string | null
          title?: string | null
        }
        Update: {
          content?: string | null
          document_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          organization_id?: string | null
          poll_id?: string | null
          published_at?: string | null
          published_by?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utskick_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utskick_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utskick_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_organization_members: {
        Args: { org_id: string }
        Returns: {
          id: string
          user_id: string
          organization_id: string
          role: string
          board_title: string
          status: string
          invited_email: string
          joined_at: string
          user_profiles: Json
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Export commonly used types
export type Organization = Tables<'organizations'>
export type Event = Tables<'events'>
export type Poll = Tables<'polls'>
export type PollVote = Tables<'poll_votes'>
export type Membership = Tables<'memberships'>
export type UserProfile = Tables<'user_profiles'>

// Combined types
export type MembershipWithOrganization = Membership & {
  organization: Organization
}

// Contact type (not auto-generated yet)
export type Contact = {
  id: string
  organization_id: string
  name: string
  email?: string | null
  phone?: string | null
  description?: string | null
  contact_type: 'user' | 'external'
  user_id?: string | null
  display_order?: number | null
  is_active?: boolean | null
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

// Meeting-specific types
export type MeetingAgenda = Tables<'meeting_agenda'>
export type MeetingAttendance = Tables<'meeting_attendance'>
export type MeetingDocument = Tables<'meeting_documents'>
export type MeetingNotes = Tables<'meeting_notes'>
export type MeetingRole = Tables<'meeting_roles'>
export type Document = Tables<'documents'>

// Combined meeting details type
export type AttendanceWithProfile = MeetingAttendance & {
  user_profiles: {
    first_name: string | null
    last_name: string | null
  } | null
  memberships: {
    board_title: string | null
    role: string
  } | null
}

export type MeetingDetails = {
  agenda: MeetingAgenda[]
  documents: (MeetingDocument & { documents: Document })[]
  notes: MeetingNotes | null
  attendance: AttendanceWithProfile[]
  roles: MeetingRole[]
}

// Messaging (migrated from web foreno)
export type Conversation = {
  id: string
  participant1_id: string
  participant2_id: string
  listing_id: string | null
  last_message: string | null
  last_message_at: string | null
  created_at: string | null
  updated_at: string | null
}

/** A direct conversation that is linked to a marketplace listing. */
export type DirectConversation = Conversation & {
  listing_id: string
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string | null
  updated_at: string | null
  image_bucket: string | null
  image_path: string | null
  image_file_name: string | null
}

export type OrganizationConversation = {
  id: string
  organization_id: string
  type: string
  name: string
  last_message: string | null
  last_message_at: string | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
}

export type OrganizationMessage = {
  id: string
  organization_conversation_id: string
  sender_id: string
  content: string
  created_at: string | null
  image_bucket: string | null
  image_path: string | null
  image_file_name: string | null
}

export type ConversationReadState = {
  user_id: string
  conversation_type: string
  conversation_id: string
  last_read_at: string
} 