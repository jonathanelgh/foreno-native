import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { MarketplaceItemCard } from '../../components/MarketplaceItemCard';
import { MarketplaceFilterModal } from '../../components/MarketplaceFilterModal';
import { getMarketplaceItems, getMarketplaceCategories } from '../../lib/api/marketplace';
import { MarketplaceItem, MarketplaceFilters, MarketplaceCategory } from '../../types/marketplace';
import { useAuth } from '../../contexts/AuthContext';

import { Car, Home, Armchair, Smartphone, Bike, Shirt, Box, Tag, SlidersHorizontal, ChevronLeft, Plus } from 'lucide-react-native';

const isIPad = Platform.OS === 'ios' && (Platform as { isPad?: boolean }).isPad === true;

const ICON_MAP: Record<string, any> = {
  Car,
  Home,
  Armchair,
  Smartphone,
  Bike,
  Shirt,
  Box,
};

export default function MarketplaceScreen() {
  const router = useRouter();
  const { session, activeOrganization } = useAuth();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<MarketplaceFilters>({ transaction_type: 'sell' });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  const rootCategories = categories.filter(c => !c.parent_id);
  const subCategories = selectedCategory 
    ? categories.filter(c => c.parent_id === selectedCategory)
    : [];

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [filters, selectedCategory, selectedSubCategory, activeOrganization]);

  const fetchCategories = async () => {
    const data = await getMarketplaceCategories();
    setCategories(data);
  };

  const fetchItems = async () => {
    if (!activeOrganization) return;
    
    setLoading(true);
    try {
      let currentFilters = { ...filters };
      
      if (selectedSubCategory) {
        currentFilters.category_id = selectedSubCategory;
      } else if (selectedCategory) {
        // If parent category selected, include it and all its children
        const childIds = categories
          .filter(c => c.parent_id === selectedCategory)
          .map(c => c.id);
        currentFilters.category_ids = [selectedCategory, ...childIds];
      }

      const data = await getMarketplaceItems(activeOrganization.id, currentFilters);
      setItems(data);
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleApplyFilters = (newFilters: MarketplaceFilters) => {
    // Extract category info from modal and sync with top bar
    const { category_id, category_ids, ...nonCategoryFilters } = newFilters;

    if (category_id) {
      const cat = categories.find(c => c.id === category_id);
      if (cat) {
        if (cat.parent_id) {
          // Walk up to find the root ancestor for the top bar
          let root = cat;
          let directChild = cat;
          while (root.parent_id) {
            const parent = categories.find(c => c.id === root.parent_id);
            if (!parent) break;
            directChild = root;
            root = parent;
          }
          setSelectedCategory(root.id);
          // Only set sub-category if it's a direct child of the root
          setSelectedSubCategory(directChild.id !== root.id ? directChild.id : null);
        } else {
          setSelectedCategory(cat.id);
          setSelectedSubCategory(null);
        }
      }
    } else {
      setSelectedCategory(null);
      setSelectedSubCategory(null);
    }

    // Store only non-category filters (category is derived from selectedCategory/selectedSubCategory in fetchItems)
    setFilters(nonCategoryFilters);
  };

  const handleItemPress = (item: MarketplaceItem) => {
    router.push({ pathname: `/listing/${item.id}` });
  };

  const getIconComponent = (iconName: string | null) => {
    if (!iconName) return Tag;
    return ICON_MAP[iconName] || Tag;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={styles.headerBar}>
          <Text style={styles.headerBarTitle}>Köp & Sälj</Text>
          <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={{ padding: 8 }}>
            <SlidersHorizontal size={24} color={Colors.light.tint} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      
      {/* Categories Horizontal Scroll */}
      <View style={styles.categoriesContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.categoriesContent}
        >
          <TouchableOpacity 
            style={[
              styles.categoryItem, 
              selectedCategory === null && styles.categoryItemActive
            ]}
            onPress={() => {
              setSelectedCategory(null);
              setSelectedSubCategory(null);
            }}
          >
            <SlidersHorizontal 
              size={16} 
              color={selectedCategory === null ? Colors.light.tint : '#6b7280'} 
            />
            <Text style={[
              styles.categoryText, 
              selectedCategory === null && styles.categoryTextActive
            ]}>Alla</Text>
          </TouchableOpacity>

          {rootCategories.map((cat) => {
            const IconComponent = getIconComponent(cat.icon);
            return (
              <TouchableOpacity 
                key={cat.id}
                style={[
                  styles.categoryItem, 
                  selectedCategory === cat.id && styles.categoryItemActive
                ]}
                onPress={() => {
                  if (selectedCategory === cat.id) {
                    setSelectedCategory(null);
                    setSelectedSubCategory(null);
                  } else {
                    setSelectedCategory(cat.id);
                    setSelectedSubCategory(null);
                  }
                }}
              >
                <IconComponent 
                  size={16} 
                  color={selectedCategory === cat.id ? Colors.light.tint : '#6b7280'} 
                />
                <Text style={[
                  styles.categoryText, 
                  selectedCategory === cat.id && styles.categoryTextActive
                ]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Subcategories */}
        {subCategories.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={[styles.categoriesContent, { marginTop: 8 }]}
          >
            <TouchableOpacity 
              style={[
                styles.subCategoryItem, 
                selectedSubCategory === null && styles.subCategoryItemActive
              ]}
              onPress={() => setSelectedSubCategory(null)}
            >
              <Text style={[
                styles.subCategoryText, 
                selectedSubCategory === null && styles.subCategoryTextActive
              ]}>Alla</Text>
            </TouchableOpacity>

            {subCategories.map((cat) => (
              <TouchableOpacity 
                key={cat.id}
                style={[
                  styles.subCategoryItem, 
                  selectedSubCategory === cat.id && styles.subCategoryItemActive
                ]}
                onPress={() => setSelectedSubCategory(selectedSubCategory === cat.id ? null : cat.id)}
              >
                <Text style={[
                  styles.subCategoryText, 
                  selectedSubCategory === cat.id && styles.subCategoryTextActive
                ]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Search & Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök i annonser..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ width: '48%', marginBottom: 16 }}>
               <MarketplaceItemCard item={item} onPress={handleItemPress} />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Inga annonser hittades</Text>
            </View>
          }
        />
      )}

      <MarketplaceFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        initialFilters={{
          ...filters,
          category_id: selectedSubCategory || selectedCategory || undefined,
        }}
      />

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => router.push('/create-listing')}
          activeOpacity={0.9}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.createButtonText}>Skapa annons</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.myAdsButton}
          onPress={() => router.push('/my-listings')}
          activeOpacity={0.7}
        >
          <Text style={styles.myAdsButtonText}>Mina annonser</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  bottomBar: {
    position: 'absolute',
    // On iPhone the tab bar is absolutely positioned, so we need more space.
    // On iPad the tab bar is in the normal layout flow, so less offset is needed.
    bottom: isIPad ? 20 : 100,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 32, // Round borders
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  createButton: {
    flex: 1,
    backgroundColor: Colors.light.tint,
    borderRadius: 30,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  myAdsButton: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  myAdsButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  categoryItemActive: {
    backgroundColor: '#eff6ff',
    borderColor: Colors.light.tint,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  categoryTextActive: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  subCategoryItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  subCategoryItemActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  subCategoryText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  subCategoryTextActive: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  collapsibleHeader: {
    position: 'absolute',
    top: 66, // Height of categories container (approx)
    left: 0,
    right: 0,
    backgroundColor: '#f9fafb',
    zIndex: 5,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    // On iPhone we need extra padding for the absolute tab bar + floating bottom bar.
    // On iPad the tab bar is in normal flow, so less padding is needed.
    paddingBottom: isIPad ? 100 : 160,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
});
