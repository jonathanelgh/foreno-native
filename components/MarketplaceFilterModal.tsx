import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, SafeAreaView, FlatList } from 'react-native';
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

type ModalView = 'filters' | 'counties' | 'municipalities' | 'categories';

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

  // Category drill-down: track the path of selected categories
  // Each entry is { id, name } representing the selected category at that level
  const [categoryPath, setCategoryPath] = useState<{ id: string; name: string }[]>([]);
  // The current level being browsed in the category picker (0 = root, 1 = sub, 2 = sub-sub)
  const [categoryBrowseLevel, setCategoryBrowseLevel] = useState(0);

  useEffect(() => {
    if (visible) {
      loadData();
      setFilters(initialFilters.transaction_type ? initialFilters : { ...initialFilters, transaction_type: 'sell' });
      setCurrentView('filters');
    }
  }, [visible]);

  // Restore categoryPath from initialFilters.category_id when categories load
  useEffect(() => {
    if (categories.length === 0) return;
    const catId = initialFilters.category_id;
    if (!catId) {
      setCategoryPath([]);
      return;
    }

    const cat = categories.find(c => c.id === catId);
    if (!cat) { setCategoryPath([]); return; }

    // Build path from root to the selected category
    const path: { id: string; name: string }[] = [];
    let current: MarketplaceCategory | undefined = cat;
    while (current) {
      path.unshift({ id: current.id, name: current.name });
      current = current.parent_id ? categories.find(c => c.id === current!.parent_id) : undefined;
    }
    setCategoryPath(path);
  }, [categories, visible]);

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

  // Get children of a category (or root categories if parentId is undefined)
  const getChildren = (parentId: string | undefined) => {
    return categories
      .filter(c => parentId ? c.parent_id === parentId : !c.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  // Get all descendant IDs of a category (for filtering)
  const getAllDescendantIds = (parentId: string): string[] => {
    const children = categories.filter(c => c.parent_id === parentId);
    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...getAllDescendantIds(child.id));
    }
    return ids;
  };

  // Display name for the selected category in the filter view
  const getSelectedCategoryDisplay = () => {
    if (categoryPath.length === 0) return 'Alla kategorier';
    return categoryPath.map(p => p.name).join(' › ');
  };

  const handleClear = () => {
    setFilters({ transaction_type: 'sell' });
    setCategoryPath([]);
  };

  const getSelectedCountyName = () => {
    if (!filters.county_id) return 'Alla';
    return counties.find(c => c.id === filters.county_id)?.name || 'Okänt';
  };

  const getSelectedMunicipalityName = () => {
    if (!filters.municipality_id) return 'Alla';
    return municipalities.find(m => m.id === filters.municipality_id)?.name || 'Okänt';
  };

  const handleApplyInternal = () => {
    let finalFilters = { ...filters };
    
    const deepestSelected = categoryPath.length > 0 ? categoryPath[categoryPath.length - 1].id : undefined;
    
    if (deepestSelected) {
      finalFilters.category_id = deepestSelected;
      const descendants = getAllDescendantIds(deepestSelected);
      if (descendants.length > 0) {
        finalFilters.category_ids = [deepestSelected, ...descendants];
      } else {
        finalFilters.category_ids = undefined;
      }
    } else {
      finalFilters.category_id = undefined;
      finalFilters.category_ids = undefined;
    }
    
    onApply(finalFilters);
    onClose();
  };

  // Open category picker at the right level
  const openCategoryPicker = () => {
    setCategoryBrowseLevel(categoryPath.length);
    setCurrentView('categories');
  };

  // Category picker: get the parent ID for the current browse level
  const getCategoryParentForLevel = (level: number): string | undefined => {
    if (level === 0) return undefined;
    return categoryPath[level - 1]?.id;
  };

  // Categories visible at the current browse level
  const currentLevelCategories = useMemo(() => {
    const parentId = getCategoryParentForLevel(categoryBrowseLevel);
    return getChildren(parentId);
  }, [categories, categoryBrowseLevel, categoryPath]);

  // Get the selected category ID at the current browse level (if any)
  const selectedAtCurrentLevel = categoryPath[categoryBrowseLevel]?.id;

  // Handle selecting a category in the picker
  const handleCategoryPickerSelect = (cat: MarketplaceCategory | null) => {
    if (!cat) {
      // "Alla" selected - trim path to current level and go back to filters
      const newPath = categoryPath.slice(0, categoryBrowseLevel);
      setCategoryPath(newPath);
      setCurrentView('filters');
      return;
    }

    // Check if this category has children
    const children = getChildren(cat.id);

    // Update path: keep everything before this level, set this level
    const newPath = [
      ...categoryPath.slice(0, categoryBrowseLevel),
      { id: cat.id, name: cat.name }
    ];
    setCategoryPath(newPath);

    if (children.length > 0) {
      // Drill into next level
      setCategoryBrowseLevel(categoryBrowseLevel + 1);
    } else {
      // Leaf category - go back to filters
      setCurrentView('filters');
    }
  };

  // Handle breadcrumb tap
  const handleBreadcrumbTap = (level: number) => {
    setCategoryBrowseLevel(level);
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
          
          <TouchableOpacity 
            style={styles.selectorRow} 
            onPress={openCategoryPicker}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.selectorValue} numberOfLines={1}>
                {getSelectedCategoryDisplay()}
              </Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
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

  const renderCategoryPicker = () => {
    const canGoBack = categoryBrowseLevel > 0;

    return (
      <>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              if (canGoBack) {
                setCategoryBrowseLevel(categoryBrowseLevel - 1);
              } else {
                setCurrentView('filters');
              }
            }} 
            style={styles.backButton}
          >
            <ChevronLeft size={24} color={Colors.light.tint} />
            <Text style={styles.backButtonText}>
              {canGoBack ? 'Tillbaka' : 'Filter'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kategori</Text>
          <TouchableOpacity 
            onPress={() => setCurrentView('filters')} 
            style={styles.doneButton}
          >
            <Text style={styles.doneButtonText}>Klar</Text>
          </TouchableOpacity>
        </View>

        {/* Breadcrumbs */}
        {categoryPath.length > 0 && (
          <View style={styles.breadcrumbContainer}>
            <TouchableOpacity onPress={() => handleBreadcrumbTap(0)}>
              <Text style={[
                styles.breadcrumbText,
                categoryBrowseLevel === 0 && styles.breadcrumbActive,
              ]}>
                Alla
              </Text>
            </TouchableOpacity>
            {categoryPath.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                <Text style={styles.breadcrumbSeparator}>›</Text>
                <TouchableOpacity onPress={() => handleBreadcrumbTap(index + 1)}>
                  <Text style={[
                    styles.breadcrumbText,
                    categoryBrowseLevel === index + 1 && styles.breadcrumbActive,
                  ]} numberOfLines={1}>
                    {crumb.name}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        )}

        <FlatList
          data={currentLevelCategories}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <TouchableOpacity 
              style={styles.listItem} 
              onPress={() => handleCategoryPickerSelect(null)}
            >
              <Text style={[
                styles.listItemText,
                !selectedAtCurrentLevel && styles.activeListItemText
              ]}>
                Alla{categoryBrowseLevel > 0 ? ` i ${categoryPath[categoryBrowseLevel - 1]?.name}` : ''}
              </Text>
              {!selectedAtCurrentLevel && (
                <Check size={20} color={Colors.light.tint} />
              )}
            </TouchableOpacity>
          }
          renderItem={({ item }) => {
            const hasChildren = getChildren(item.id).length > 0;
            const isSelected = selectedAtCurrentLevel === item.id;

            return (
              <TouchableOpacity 
                style={styles.listItem} 
                onPress={() => handleCategoryPickerSelect(item)}
              >
                <View style={styles.listItemContent}>
                  <Text style={[
                    styles.listItemText, 
                    isSelected && styles.activeListItemText
                  ]}>
                    {item.name}
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  {isSelected && !hasChildren && (
                    <Check size={20} color={Colors.light.tint} />
                  )}
                  {hasChildren && (
                    <ChevronRight size={20} color={isSelected ? Colors.light.tint : '#9ca3af'} />
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      </>
    );
  };

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
        {currentView === 'categories' && renderCategoryPicker()}
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
    width: 80,
  },
  backButtonText: {
    color: Colors.light.tint,
    fontSize: 16,
    marginLeft: 4,
  },
  doneButton: {
    width: 80,
    alignItems: 'flex-end',
  },
  doneButtonText: {
    color: Colors.light.tint,
    fontSize: 16,
    fontWeight: '600',
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
  // Breadcrumbs
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexWrap: 'wrap',
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 14,
    color: Colors.light.tint,
  },
  breadcrumbActive: {
    fontWeight: '600',
    color: '#111827',
  },
  breadcrumbSeparator: {
    fontSize: 14,
    color: '#9ca3af',
    marginHorizontal: 2,
  },
  // List
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listItemContent: {
    flex: 1,
    marginRight: 12,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
