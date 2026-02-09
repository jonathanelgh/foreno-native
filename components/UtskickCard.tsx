import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    StyleProp,
    ViewStyle
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getPollResults, hasUserVoted, submitPollVote } from '../lib/api/polls';

interface UtskickCardProps {
  utskick: any;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const UtskickCard: React.FC<UtskickCardProps> = ({ utskick, onPress, style }) => {
  const { user, memberships, activeOrganization } = useAuth();
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [hasVoted, setHasVoted] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const [showVoting, setShowVoting] = useState(false);
  const hasImage = typeof utskick.image_url === 'string' && utskick.image_url.trim().length > 0;
  const imageUrl = hasImage ? utskick.image_url.trim() : undefined;
  const [shouldShowImage, setShouldShowImage] = useState(hasImage);

  // Get current membership ID for the active organization
  const currentMembership = memberships.find(
    m => m.organization_id === activeOrganization?.id
  );

  useEffect(() => {
    if (utskick.polls && currentMembership) {
      checkVoteStatus();
      loadResults();
    }
  }, [utskick.polls, currentMembership]);

  const checkVoteStatus = async () => {
    if (currentMembership && utskick.polls) {
      try {
        const voted = await hasUserVoted(utskick.polls.id, currentMembership.id);
        setHasVoted(voted);
        setShowVoting(!voted); // Show voting interface if not voted yet
      } catch (error) {
        console.error('Error checking vote status:', error);
      }
    }
  };

  const loadResults = async () => {
    if (utskick.polls) {
      try {
        const pollResults = await getPollResults(utskick.polls.id);
        setResults(pollResults);
      } catch (error) {
        console.error('Error loading poll results:', error);
      }
    }
  };

  const handleVote = async () => {
    if (!selectedOption) {
      Alert.alert('Fel', 'Välj ett alternativ');
      return;
    }

    if (!currentMembership) {
      Alert.alert('Fel', 'Kunde inte hitta medlemskap');
      return;
    }

    setPollLoading(true);
    try {
      await submitPollVote(utskick.polls.id, [selectedOption], currentMembership.id);
      setHasVoted(true);
      setShowVoting(false);
      await loadResults();
      Alert.alert('Tack!', 'Din röst har registrerats');
      setSelectedOption(''); // Reset selection
    } catch (error) {
      console.error('Error submitting vote:', error);
      Alert.alert('Fel', 'Kunde inte registrera röst. Försök igen.');
    } finally {
      setPollLoading(false);
    }
  };

  const handleChangeVote = () => {
    setShowVoting(true);
    setSelectedOption(''); // Reset selection when changing vote
  };

  useEffect(() => {
    setShouldShowImage(hasImage);
  }, [hasImage]);

  const handleCancelVote = () => {
    setShowVoting(false);
    setSelectedOption(''); // Reset selection when canceling
  };

  const getTotalVotes = () => {
    return results.reduce((sum, option) => sum + (option.vote_count || 0), 0);
  };

  const getPercentage = (votes: number) => {
    const total = getTotalVotes();
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const monthNames = [
      'januari', 'februari', 'mars', 'april', 'maj', 'juni',
      'juli', 'augusti', 'september', 'oktober', 'november', 'december'
    ];
    
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  const handleFileDownload = async () => {
    if (utskick.file_url) {
      try {
        const supported = await Linking.canOpenURL(utskick.file_url);
        if (supported) {
          Alert.alert(
            'Ladda ner fil',
            `Vill du öppna ${utskick.file_name || 'filen'}?`,
            [
              { text: 'Avbryt', style: 'cancel' },
              { 
                text: 'Öppna', 
                onPress: () => Linking.openURL(utskick.file_url)
              }
            ]
          );
        } else {
          Alert.alert('Fel', 'Kan inte öppna denna filtyp');
        }
      } catch (error) {
        Alert.alert('Fel', 'Kunde inte öppna filen');
      }
    }
  };

  const stripHtml = (html: string) => {
    return html?.replace(/<[^>]*>/g, '') || '';
  };

  return (
    <TouchableOpacity 
      style={[styles.card, style]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{utskick.title}</Text>
        <Text style={styles.date}>{formatDate(utskick.published_at || utskick.created_at)}</Text>
      </View>

      {/* Image */}
      {shouldShowImage && (
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: imageUrl ?? undefined }} 
            style={styles.image}
            contentFit="cover"
            onError={() => setShouldShowImage(false)}
          />
        </View>
      )}

      {/* Content */}
      {utskick.content && (
        <Text style={styles.content}>
          {stripHtml(utskick.content)}
        </Text>
      )}

      {/* File Attachment */}
      {utskick.file_url && (
        <TouchableOpacity
          style={styles.attachment}
          onPress={handleFileDownload}
        >
          <Feather name="file-text" size={18} color="#2563eb" />
          <Text style={styles.attachmentText}>
            📎 {utskick.file_name || 'Bifogad fil'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Polls */}
      {utskick.polls && (
        <View style={styles.pollContainer}>
          <Text style={styles.pollQuestion}>{utskick.polls.question}</Text>

          {showVoting ? (
            <View style={styles.votingSection}>
              {utskick.polls.options?.map((option: string, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.pollOption,
                    selectedOption === option && styles.selectedPollOption,
                  ]}
                  onPress={() => setSelectedOption(option)}
                >
                  <Feather
                    name={selectedOption === option ? 'check-circle' : 'circle'}
                    size={24}
                    color={selectedOption === option ? '#2563eb' : '#6b7280'}
                  />
                  <Text style={styles.pollOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.voteButtonContainer}>
                <TouchableOpacity
                  style={[styles.voteButton, (pollLoading || !selectedOption) && styles.voteButtonDisabled]}
                  onPress={handleVote}
                  disabled={pollLoading || !selectedOption}
                >
                  {pollLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.voteButtonText}>
                      {hasVoted ? 'Ändra röst' : 'Rösta'}
                    </Text>
                  )}
                </TouchableOpacity>

                {hasVoted && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelVote}
                  >
                    <Text style={styles.cancelButtonText}>Avbryt</Text>
                  </TouchableOpacity>
                )}
              </View>
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

              {hasVoted && (
                <TouchableOpacity
                  style={styles.changeVoteButton}
                  onPress={handleChangeVote}
                >
                  <Text style={styles.changeVoteButtonText}>Ändra min röst</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  imageContainer: {
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 12,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  attachmentText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '500',
  },
  pollContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
    marginTop: 16,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  votingSection: {
    gap: 8,
  },
  pollOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  selectedPollOption: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  pollOptionText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#374151',
  },
  voteButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  voteButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  voteButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  voteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsSection: {
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  resultItem: {
    marginBottom: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 16,
    color: '#374151',
  },
  resultPercentage: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#d1d5db',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  voteCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  totalVotes: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  cancelButton: {
    backgroundColor: '#d1d5db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  changeVoteButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  changeVoteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 