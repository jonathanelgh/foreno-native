import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { getListingById, ListingDetail } from '../../lib/api/marketplace';
import { getOrCreateListingConversation } from '../../lib/api/messages';
import { Avatar } from '../../components/Avatar';
import { IconSymbol } from '../../components/ui/IconSymbol';

/* ── Skeleton shimmer block ── */
function SkeletonBlock({ width, height, borderRadius = 6, style }: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.ease,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#e5e7eb',
          opacity,
        },
        style,
      ]}
    />
  );
}

function ListingSkeleton() {
  return (
    <View style={styles.container}>
      {/* Image placeholder */}
      <SkeletonBlock width={SCREEN_WIDTH} height={IMAGE_HEIGHT} borderRadius={0} />

      {/* Thumbnail row */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
        <SkeletonBlock width={THUMBNAIL_SIZE} height={THUMBNAIL_SIZE} borderRadius={8} />
        <SkeletonBlock width={THUMBNAIL_SIZE} height={THUMBNAIL_SIZE} borderRadius={8} />
        <SkeletonBlock width={THUMBNAIL_SIZE} height={THUMBNAIL_SIZE} borderRadius={8} />
      </View>

      {/* Content */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
        {/* Transaction label */}
        <SkeletonBlock width={60} height={14} style={{ marginBottom: 8 }} />
        {/* Title */}
        <SkeletonBlock width="85%" height={22} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="55%" height={22} style={{ marginBottom: 12 }} />
        {/* Price */}
        <SkeletonBlock width={140} height={20} style={{ marginBottom: 20 }} />
        {/* Description lines */}
        <SkeletonBlock width="100%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="90%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="70%" height={14} style={{ marginBottom: 20 }} />

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 16 }} />

        {/* Seller */}
        <SkeletonBlock width={60} height={12} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SkeletonBlock width={44} height={44} borderRadius={22} />
          <SkeletonBlock width={120} height={16} style={{ marginLeft: 12 }} />
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 16 }} />

        {/* Details */}
        <SkeletonBlock width={160} height={14} style={{ marginBottom: 10 }} />
        <SkeletonBlock width={100} height={14} style={{ marginBottom: 10 }} />
        <SkeletonBlock width={180} height={14} />
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 400;
const THUMBNAIL_SIZE = 72;

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [sendingMessage, setSendingMessage] = useState(false);

  const imageListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) loadListing();
  }, [id]);

  const loadListing = async () => {
    setLoading(true);
    try {
      const data = await getListingById(id!);
      setListing(data);
    } catch (e) {
      console.error('Error loading listing:', e);
    } finally {
      setLoading(false);
    }
  };

  const images = listing?.signed_image_urls || [];
  const hasImages = images.length > 0;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      setActiveImageIndex(index);
    },
    []
  );

  const scrollToImage = useCallback((index: number) => {
    imageListRef.current?.scrollToIndex({ index, animated: true });
    setActiveImageIndex(index);
  }, []);

  const goToPrevImage = useCallback(() => {
    if (activeImageIndex > 0) {
      scrollToImage(activeImageIndex - 1);
    }
  }, [activeImageIndex, scrollToImage]);

  const goToNextImage = useCallback(() => {
    if (activeImageIndex < images.length - 1) {
      scrollToImage(activeImageIndex + 1);
    }
  }, [activeImageIndex, images.length, scrollToImage]);

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'sell':
        return 'Säljes';
      case 'buy':
        return 'Köpes';
      case 'give':
        return 'Skänkes';
      default:
        return type;
    }
  };

  const formatPrice = (price: number | null, transactionType: string) => {
    if (transactionType === 'give') return 'Gratis';
    if (price === null || price === 0) return 'Pris ej angivet';
    return `${price.toLocaleString('sv-SE')} kr`;
  };

  const handleSendMessage = async () => {
    if (!listing || !user) return;
    if (listing.created_by === user.id) {
      Alert.alert('', 'Du kan inte skicka meddelande till dig själv.');
      return;
    }

    setSendingMessage(true);
    try {
      const conv = await getOrCreateListingConversation(
        user.id,
        listing.created_by,
        listing.id
      );
      router.push({
        pathname: `/conversation/${conv.id}`,
        params: { type: 'direct' },
      });
    } catch (e) {
      console.error('Error creating conversation:', e);
      Alert.alert('Fel', 'Kunde inte starta konversation. Försök igen.');
    } finally {
      setSendingMessage(false);
    }
  };

  const creatorName = listing?.creator
    ? [listing.creator.first_name, listing.creator.last_name]
        .filter(Boolean)
        .join(' ') || 'Okänd användare'
    : 'Okänd användare';

  const isOwnListing = listing?.created_by === user?.id;

  const openMaps = (city: string) => {
    const encoded = encodeURIComponent(city);
    const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(url);
  };

  const headerOptions = {
    headerShown: true,
    title: '',
    headerBackTitle: 'Tillbaka',
    headerStyle: { backgroundColor: '#fff' },
    headerShadowVisible: false,
    headerLeft: () => (
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          marginLeft: -8,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Feather name="chevron-left" size={28} color={Colors.light.tint} />
      </TouchableOpacity>
    ),
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <ListingSkeleton />
      </>
    );
  }

  if (!listing) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View style={styles.loadingContainer}>
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={48} color="#9ca3af" />
            <Text style={styles.errorText}>Annonsen kunde inte hittas</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Gå tillbaka</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  const renderImageItem = ({ item }: { item: string }) => (
    <Image source={{ uri: item }} style={styles.carouselImage} resizeMode="cover" />
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Carousel */}
        {hasImages ? (
          <View style={styles.imageCarouselContainer}>
            <FlatList
              ref={imageListRef}
              data={images}
              renderItem={renderImageItem}
              keyExtractor={(_, i) => i.toString()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
            />

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                {activeImageIndex > 0 && (
                  <TouchableOpacity
                    style={[styles.navArrow, styles.navArrowLeft]}
                    onPress={goToPrevImage}
                    activeOpacity={0.7}
                  >
                    <Feather name="chevron-left" size={28} color="#fff" />
                  </TouchableOpacity>
                )}
                {activeImageIndex < images.length - 1 && (
                  <TouchableOpacity
                    style={[styles.navArrow, styles.navArrowRight]}
                    onPress={goToNextImage}
                    activeOpacity={0.7}
                  >
                    <Feather name="chevron-right" size={28} color="#fff" />
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Image counter badge */}
            {images.length > 1 && (
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {activeImageIndex + 1}/{images.length}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.placeholderImage}>
            <IconSymbol name="photo" size={64} color="#9ca3af" />
          </View>
        )}

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <View style={styles.thumbnailStrip}>
            {images.map((uri, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => scrollToImage(index)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri }}
                  style={[
                    styles.thumbnail,
                    activeImageIndex === index && styles.thumbnailActive,
                  ]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Transaction type label */}
          <Text style={styles.transactionLabel}>
            {getTransactionLabel(listing.transaction_type)}
          </Text>

          {/* Title */}
          <Text style={styles.title}>{listing.title}</Text>

          {/* Price */}
          <Text style={styles.price}>
            {formatPrice(listing.price, listing.transaction_type)}
          </Text>

          {/* Description */}
          {listing.description ? (
            <Text style={styles.description}>{listing.description}</Text>
          ) : null}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Seller info */}
          <View style={styles.sellerSection}>
            <Text style={styles.sectionLabel}>Säljare</Text>
            <View style={styles.sellerRow}>
              <Avatar
                url={listing.creator?.profile_image_url}
                size={44}
                name={creatorName}
                placeholderColor="#eff6ff"
              />
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{creatorName}</Text>
              </View>
            </View>
          </View>

          {/* Location */}
          {listing.city ? (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => openMaps(listing.city!)}
                activeOpacity={0.6}
              >
                <Feather name="map-pin" size={16} color={Colors.light.tint} />
                <Text style={[styles.detailText, styles.detailLink]}>{listing.city}</Text>
                <Feather name="external-link" size={13} color={Colors.light.tint} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </>
          ) : null}

          {/* Category */}
          {listing.category?.name ? (
            <View style={styles.detailRow}>
              <Feather name="tag" size={16} color="#6b7280" />
              <Text style={styles.detailText}>{listing.category.name}</Text>
            </View>
          ) : null}

          {/* Date */}
          <View style={styles.detailRow}>
            <Feather name="calendar" size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              Publicerad{' '}
              {new Date(listing.created_at).toLocaleDateString('sv-SE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom bar with message button */}
      {!isOwnListing && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={handleSendMessage}
            activeOpacity={0.7}
            disabled={sendingMessage}
          >
            {sendingMessage ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="message-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.messageButtonText}>Skicka meddelande</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
  },
  backButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Scroll */
  scrollView: {
    flex: 1,
  },

  /* Image Carousel */
  imageCarouselContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navArrowLeft: {
    left: 12,
  },
  navArrowRight: {
    right: 12,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  placeholderImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Thumbnails */
  thumbnailStrip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: Colors.light.tint,
  },

  /* Content */
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  transactionLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 28,
    marginBottom: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 4,
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },

  /* Seller */
  sellerSection: {
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  /* Details */
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailLink: {
    color: Colors.light.tint,
    fontWeight: '500',
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  messageButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
