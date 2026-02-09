import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MarketplaceItem } from '../types/marketplace';
import { Colors } from '../constants/Colors';
import { IconSymbol } from './ui/IconSymbol';
import { ProductImage } from './ProductImage';

interface MarketplaceItemCardProps {
  item: MarketplaceItem;
  onPress: (item: MarketplaceItem) => void;
}

export const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({ item, onPress }) => {
  const formattedDate = new Date(item.created_at).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const imagePath = item.listing_images?.[0]?.path || null;
  const bucket = item.listing_images?.[0]?.bucket || 'listing_images';

  const getBadgeText = (type: string) => {
    switch (type) {
      case 'sell': return 'Säljes';
      case 'buy': return 'Köpes';
      case 'give': return 'Skänkes';
      default: return type;
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        {imagePath ? (
          <ProductImage 
            path={imagePath} 
            bucket={bucket}
            style={styles.image} 
            resizeMode="cover" 
          />
        ) : (
          <View style={[styles.image, styles.placeholderImage]}>
             <IconSymbol name="photo" size={40} color="#9ca3af" />
          </View>
        )}
        <View style={styles.badge}>
            <Text style={styles.badgeText}>{getBadgeText(item.transaction_type)}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <View style={styles.headerRow}>
            <Text style={styles.category}>{item.category?.name || 'Övrigt'}</Text>
            <Text style={styles.date}>{formattedDate}</Text>
        </View>
        
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.price}>
          {item.price !== null && item.price > 0 
            ? `${item.price.toLocaleString('sv-SE')} kr` 
            : item.transaction_type === 'give' ? 'Gratis' : 'Pris ej angivet'}
        </Text>
        
        <View style={styles.locationRow}>
          <IconSymbol name="location" size={14} color="#6b7280" />
          <Text style={styles.location}>{item.city || 'Plats ej angiven'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    flex: 1, // Fill the container
  },
  imageContainer: {
    height: 140, // Reduced height for grid
    width: '100%',
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    padding: 10, // Reduced padding
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  category: {
    fontSize: 11,
    color: Colors.light.tint,
    fontWeight: '600',
  },
  date: {
    fontSize: 11,
    color: '#9ca3af',
  },
  title: {
    fontSize: 14, // Smaller font
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 18,
    height: 36, // Limit height to 2 lines approximately
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 12,
    color: '#6b7280',
  },
});
