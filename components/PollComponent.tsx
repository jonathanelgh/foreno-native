import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getPollResults, hasUserVoted, submitPollVote } from '../lib/api/polls';

interface PollComponentProps {
  poll: any;
}

export const PollComponent: React.FC<PollComponentProps> = ({ poll }) => {
  const { user, memberships, activeOrganization } = useAuth();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Get current membership ID for the active organization
  const currentMembership = memberships.find(
    m => m.organization_id === activeOrganization?.id
  );

  useEffect(() => {
    checkVoteStatus();
    loadResults();
  }, []);

  const checkVoteStatus = async () => {
    if (currentMembership) {
      try {
        const voted = await hasUserVoted(poll.id, currentMembership.id);
        setHasVoted(voted);
      } catch (error) {
        console.error('Error checking vote status:', error);
      }
    }
    setInitialLoading(false);
  };

  const loadResults = async () => {
    try {
      const pollResults = await getPollResults(poll.id);
      setResults(pollResults);
    } catch (error) {
      console.error('Error loading poll results:', error);
    }
  };

  const handleOptionSelect = (option: string) => {
    if (hasVoted) return;
    
    // For now, treat all polls as single-choice since we don't have poll_type in the new schema
    setSelectedOptions([option]);
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0) {
      Alert.alert('Fel', 'Välj minst ett alternativ');
      return;
    }

    if (!currentMembership) {
      Alert.alert('Fel', 'Kunde inte hitta medlemskap');
      return;
    }

    setLoading(true);
    try {
      await submitPollVote(poll.id, selectedOptions, currentMembership.id);
      setHasVoted(true);
      await loadResults();
      Alert.alert('Tack!', 'Din röst har registrerats');
    } catch (error) {
      console.error('Error submitting vote:', error);
      Alert.alert('Fel', 'Kunde inte registrera röst');
    } finally {
      setLoading(false);
    }
  };

  const getTotalVotes = () => {
    return results.reduce((sum, option) => sum + (option.vote_count || 0), 0);
  };

  const getPercentage = (votes: number) => {
    const total = getTotalVotes();
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  };

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.question}>{poll.question}</Text>
        <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{poll.question}</Text>

      {!hasVoted ? (
        <View style={styles.votingSection}>
          {poll.options?.map((option: string, index: number) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.option,
                selectedOptions.includes(option) && styles.selectedOption,
              ]}
              onPress={() => handleOptionSelect(option)}
            >
              <Ionicons
                name={
                  selectedOptions.includes(option)
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={24}
                color={
                  selectedOptions.includes(option) ? '#2563eb' : '#6b7280'
                }
              />
              <Text style={styles.optionText}>{option}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.voteButton, (loading || selectedOptions.length === 0) && styles.voteButtonDisabled]}
            onPress={handleVote}
            disabled={loading || selectedOptions.length === 0}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.voteButtonText}>Rösta</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsTitle}>Resultat:</Text>
          {results.map((option: any) => (
            <View key={option.id} style={styles.resultItem}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultText}>{option.option_text}</Text>
                <Text style={styles.resultPercentage}>
                  {getPercentage(option.vote_count)}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${getPercentage(option.vote_count)}%` },
                  ]}
                />
              </View>
              <Text style={styles.voteCount}>
                {option.vote_count} röst{option.vote_count !== 1 ? 'er' : ''}
              </Text>
            </View>
          ))}
          <Text style={styles.totalVotes}>
            Totalt: {getTotalVotes()} röst{getTotalVotes() !== 1 ? 'er' : ''}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
    marginTop: 16,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  votingSection: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  selectedOption: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  voteButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  voteButtonDisabled: {
    opacity: 0.6,
  },
  voteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsSection: {
    gap: 8,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  resultItem: {
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  resultPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  voteCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  totalVotes: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});

export default PollComponent; 