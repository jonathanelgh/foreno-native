import { supabase } from "../supabase";

export interface UserNote {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const getUserNote = async (userId: string): Promise<UserNote | null> => {
  const { data, error } = await supabase
    .from("user_notes")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned, which is fine for a new user
      return null;
    }
    console.error("Error fetching user note:", error);
    return null;
  }

  return data;
};

export const saveUserNote = async (userId: string, content: string): Promise<UserNote | null> => {
  // First try to update existing note
  const { data: existingNote } = await supabase
    .from("user_notes")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existingNote) {
    const { data, error } = await supabase
      .from("user_notes")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", existingNote.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating user note:", error);
      return null;
    }
    return data;
  } else {
    // Create new note
    const { data, error } = await supabase
      .from("user_notes")
      .insert({ user_id: userId, content })
      .select()
      .single();

    if (error) {
      console.error("Error creating user note:", error);
      return null;
    }
    return data;
  }
};
