import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, SafeAreaView, FlatList, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { IconSymbol } from './ui/IconSymbol';
import { MarketplaceFilters, MarketplaceCategory } from '../types/marketplace';
import { getMarketplaceCategories, getCounties, getMunicipalities } from '../lib/api/marketplace';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react-native';

interface MarketplaceFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: MarketplaceFilters) => void;
  initialFilters?: MarketplaceFilters;
}

type ModalView = 'filters' | 'counties' | 'municipalities';

export const MarketplaceFilterModal: React.FC<MarketplaceFilterModalProps> = ({ 
  visible, 
  onClose, 
  onApply,
  initialFilters = {} 
}) => {
  const [filters, setFilters] = useState<MarketplaceFilters>(initialFilters);
  const [currentView, setCurrentView] = useState<ModalView>('filters');
  
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [counties, setCounties] = useState<any[]>([]);
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
      setFilters(initialFilters.transaction_type ? initialFilters : { ...initialFilters, transaction_type: 'sell' });
      setCurrentView('filters');
    }
  }, [visible]);

  useEffect(() => {
    if (filters.county_id) {
      loadMunicipalities(filters.county_id);
    } else {
      setMunicipalities([]);
    }
  }, [filters.county_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, cnts] = await Promise.all([
        getMarketplaceCategories(),
        getCounties()
      ]);
      setCategories(cats);
      setCounties(cnts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMunicipalities = async (countyId: string) => {
    const munis = await getMunicipalities(countyId);
    setMunicipalities(munis);
  };

  const types = [
    { label: 'Säljes', value: 'sell' }, 
    { label: 'Köpes', value: 'buy' },
    { label: 'Skänkes', value: 'give' }
  ];

  const handleClear = () => {
    setFilters({ transaction_type: 'sell' });
  };

  const getSelectedCountyName = () => {
    if (!filters.county_id) return 'Alla';
    return counties.find(c => c.id === filters.county_id)?.name || 'Okänt';
  };

  const getSelectedMunicipalityName = () => {
    if (!filters.municipality_id) return 'Alla';
    return municipalities.find(m => m.id === filters.municipality_id)?.name || 'Okänt';
  };

  // Logic for Categories
  const rootCategories = categories.filter(c => !c.parent_id);
  
  // Determine active parent to show subcategories
  const selectedCategoryObj = categories.find(c => c.id === filters.category_id);
  const activeParentId = selectedCategoryObj?.parent_id ?? (selectedCategoryObj ? selectedCategoryObj.id : null);
  
  const subCategories = activeParentId 
    ? categories.filter(c => c.parent_id === activeParentId)
    : [];

  const handleCategorySelect = (categoryId: string | undefined) => {
    // If deselecting or selecting "Alla", clear everything
    if (!categoryId) {
      setFilters({ ...filters, category_id: undefined, category_ids: undefined });
      return;
    }

    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    // If selecting a root category, we might want to include its children in category_ids
    // But we'll do this calculation when Applying or just set category_id here and let UI react
    // We update filters immediately
    setFilters({ ...filters, category_id: categoryId });
  };

  // Update handleApply to expand category_ids if needed
  const handleApplyInternal = () => {
    let finalFilters = { ...filters };
    
    // If a category is selected, check if it's a parent and expand children
    if (finalFilters.category_id) {
      const category = categories.find(c => c.id === finalFilters.category_id);
      if (category && !category.parent_id) {
        // It's a root category, find all children
        const children = categories.filter(c => c.parent_id === category.id);
        if (children.length > 0) {
          finalFilters.category_ids = [category.id, ...children.map(c => c.id)];
        }
      }
    }
    
    onApply(finalFilters);
    onClose();
  };

  const renderFilterView = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Filtrera</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <IconSymbol name="xmark" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategori</Text>
          <View style={styles.chipContainer}>
            <TouchableOpacity
              style={[
                styles.chip,
                !filters.category_id && styles.activeChip
              ]}
              onPress={() => handleCategorySelect(undefined)}
            >
              <Text style={[
                styles.chipText,
                !filters.category_id && styles.activeChipText
              ]}>
                Alla
              </Text>
            </TouchableOpacity>
            {rootCategories.map((cat) => {
              const isActive = filters.category_id === cat.id || (activeParentId === cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    isActive && styles.activeChip
                  ]}
                  onPress={() => handleCategorySelect(cat.id)}
                >
                  <Text style={[
                    styles.chipText,
                    isActive && styles.activeChipText
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Subcategories List */}
          {subCategories.length > 0 && (
            <View style={[styles.chipContainer, { marginTop: 12, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#e5e7eb' }]}>
               <TouchableOpacity
                style={[
                  styles.chip,
                  styles.smallChip,
                  filters.category_id === activeParentId && styles.activeChip
                ]}
                onPress={() => handleCategorySelect(activeParentId || undefined)}
              >
                <Text style={[
                  styles.chipText,
                  styles.smallChipText,
                  filters.category_id === activeParentId && styles.activeChipText
                ]}>
                  Alla i {categories.find(c => c.id === activeParentId)?.name}
                </Text>
              </TouchableOpacity>
              {subCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    styles.smallChip,
                    filters.category_id === cat.id && styles.activeChip
                  ]}
                  onPress={() => handleCategorySelect(cat.id)}
                >
                  <Text style={[
                    styles.chipText,
                    styles.smallChipText,
                    filters.category_id === cat.id && styles.activeChipText
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Typ</Text>
          <View style={styles.chipContainer}>
            {types.map((type) => (
              <TouchableOpacity
                key={type.label}
                style={[
                  styles.chip,
                  filters.transaction_type === type.value && styles.activeChip
                ]}
                onPress={() => setFilters({ ...filters, transaction_type: type.value as any })}
              >
                <Text style={[
                  styles.chipText,
                  filters.transaction_type === type.value && styles.activeChipText
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plats</Text>
          
          <TouchableOpacity 
            style={styles.selectorRow} 
            onPress={() => setCurrentView('counties')}
          >
            <View>
              <Text style={styles.selectorLabel}>Län</Text>
              <Text style={styles.selectorValue}>{getSelectedCountyName()}</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.selectorRow, !filters.county_id && styles.disabledRow]} 
            onPress={() => filters.county_id && setCurrentView('municipalities')}
            disabled={!filters.county_id}
          >
            <View>
              <Text style={styles.selectorLabel}>Kommun</Text>
              <Text style={styles.selectorValue}>{getSelectedMunicipalityName()}</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pris (kr)</Text>
          <View style={styles.row}>
              <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Från"
              keyboardType="numeric"
              value={filters.minPrice?.toString()}
              onChangeText={(text) => setFilters({ ...filters, minPrice: text ? parseInt(text) : undefined })}
              />
              <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Till"
              keyboardType="numeric"
              value={filters.maxPrice?.toString()}
              onChangeText={(text) => setFilters({ ...filters, maxPrice: text ? parseInt(text) : undefined })}
              />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Rensa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={handleApplyInternal}>
          <Text style={styles.applyButtonText}>Visa resultat</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSelectionList = (
    title: string, 
    data: any[], 
    selectedId: string | undefined, 
    onSelect: (item: any | null) => void
  ) => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('filters')} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.light.tint} />
          <Text style={styles.backButtonText}>Tillbaka</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 80 }} /> 
      </View>
      <FlatList
        data={[{ id: 'all', name: 'Alla' }, ...data]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.listItem} 
            onPress={() => {
              onSelect(item.id === 'all' ? null : item);
              setCurrentView('filters');
            }}
          >
            <Text style={[
              styles.listItemText, 
              (selectedId === item.id || (!selectedId && item.id === 'all')) && styles.activeListItemText
            ]}>
              {item.name}
            </Text>
            {(selectedId === item.id || (!selectedId && item.id === 'all')) && (
              <Check size={20} color={Colors.light.tint} />
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {currentView === 'filters' && renderFilterView()}
        {currentView === 'counties' && renderSelectionList(
          'Välj län', 
          counties, 
          filters.county_id, 
          (item) => setFilters({ ...filters, county_id: item?.id, municipality_id: undefined })
        )}
        {currentView === 'municipalities' && renderSelectionList(
          'Välj kommun', 
          municipalities, 
          filters.municipality_id, 
          (item) => setFilters({ ...filters, municipality_id: item?.id })
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: Colors.light.tint,
    fontSize: 16,
    marginLeft: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activeChip: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  chipText: {
    fontSize: 14,
    color: '#4b5563',
  },
  activeChipText: {
    color: '#fff',
    fontWeight: '500',
  },
  smallChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  smallChipText: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  row: {
      flexDirection: 'row',
      gap: 12,
  },
  halfInput: {
      flex: 1,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    gap: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  applyButton: {
    flex: 2,
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginBottom: 12,
  },
  disabledRow: {
    backgroundColor: '#f3f4f6',
    opacity: 0.7,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  selectorValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listItemText: {
    fontSize: 16,
    color: '#374151',
  },
  activeListItemText: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  }
});
