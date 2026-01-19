import { Database } from '../../types/database';
import { supabase } from "../supabase";

type Poll = Database['public']['Tables']['polls']['Row'];
type PollInsert = Database['public']['Tables']['polls']['Insert'];

export const submitPollVote = async (
  pollId: string,
  selectedOptions: string[],
  membershipId?: string
) => {
  if (!membershipId) {
    throw new Error('Membership ID is required');
  }

  // First, delete any existing votes for this user on this poll
  const { error: deleteError } = await supabase
    .from("poll_votes")
    .delete()
    .eq("poll_id", pollId)
    .eq("membership_id", membershipId);

  if (deleteError) {
    console.error('Error deleting existing votes:', deleteError);
    // Don't throw here, continue with inserting new vote
  }

  // Then insert the new votes
  const votes = selectedOptions.map((option) => ({
    poll_id: pollId,
    selected_option: option,
    membership_id: membershipId,
  }));

  const { error } = await supabase.from("poll_votes").insert(votes);

  if (error) throw error;
};

export const getPollResults = async (pollId: string) => {
  // First get the poll to know the available options
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("options")
    .eq("id", pollId)
    .single();

  if (pollError) throw pollError;

  // Then get all votes for this poll
  const { data: votes, error: votesError } = await supabase
    .from("poll_votes")
    .select("selected_option")
    .eq("poll_id", pollId);

  if (votesError) throw votesError;

  // Count votes for each option
  const voteCounts: { [key: string]: number } = {};
  votes?.forEach((vote) => {
    if (vote.selected_option) {
      voteCounts[vote.selected_option] = (voteCounts[vote.selected_option] || 0) + 1;
    }
  });

  // Return results in the expected format
  return (poll.options || []).map((option: string, index: number) => ({
    id: `${pollId}-${index}`,
    option_text: option,
    option_order: index,
    vote_count: voteCounts[option] || 0,
  }));
};

export const hasUserVoted = async (
  pollId: string,
  membershipId: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("poll_votes")
    .select("id")
    .eq("poll_id", pollId)
    .eq("membership_id", membershipId)
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
};

export async function createPoll(poll: Omit<PollInsert, 'id' | 'created_at'>): Promise<Poll> {
  const { data, error } = await supabase
    .from('polls')
    .insert(poll)
    .select()
    .single();

  if (error) {
    console.error('Error creating poll:', error);
    throw new Error('Kunde inte skapa omröstning');
  }

  return data;
}

export async function getPollsByOrganization(organizationId: string): Promise<Poll[]> {
  const { data, error } = await supabase
    .from('polls')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching polls:', error);
    throw new Error('Kunde inte hämta omröstningar');
  }

  return data || [];
}

export async function deletePoll(pollId: string): Promise<void> {
  const { error } = await supabase
    .from('polls')
    .delete()
    .eq('id', pollId);

  if (error) {
    console.error('Error deleting poll:', error);
    throw new Error('Kunde inte ta bort omröstning');
  }
} 