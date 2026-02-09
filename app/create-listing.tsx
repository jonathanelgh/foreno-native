import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ChevronRight, ChevronLeft, Check, X, Plus, Camera, Eye } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { MarketplaceCategory } from '../types/marketplace';
import {
  getMarketplaceCategories,
  getCounties,
  getMunicipalities,
  createListing,
  uploadListingImage,
} from '../lib/api/marketplace';

type TransactionType = 'sell' | 'buy' | 'give';

interface ImageFile {
  uri: string;
  id: string;
}

export default function CreateListingScreen() {
  const router = useRouter();
  const { user, activeOrganization } = useAuth();

  // Form state
  const [transactionType, setTransactionType] = useState<TransactionType>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [countyId, setCountyId] = useState<string | undefined>();
  const [municipalityId, setMunicipalityId] = useState<string | undefined>();
  const [images, setImages] = useState<ImageFile[]>([]);

  // Category state
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [categoryPath, setCategoryPath] = useState<{ id: string; name: string }[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categoryBrowseLevel, setCategoryBrowseLevel] = useState(0);

  // Location state
  const [counties, setCounties] = useState<any[]>([]);
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [showCountyPicker, setShowCountyPicker] = useState(false);
  const [showMunicipalityPicker, setShowMunicipalityPicker] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (countyId) {
      loadMunicipalities(countyId);
    } else {
      setMunicipalities([]);
      setMunicipalityId(undefined);
    }
  }, [countyId]);

  const loadInitialData = async () => {
    try {
      const [cats, cnts] = await Promise.all([
        getMarketplaceCategories(),
        getCounties(),
      ]);
      setCategories(cats);
      setCounties(cnts);
    } catch (e) {
      console.error('Error loading data:', e);
    }
  };

  const loadMunicipalities = async (cId: string) => {
    const munis = await getMunicipalities(cId);
    setMunicipalities(munis);
  };

  // Category helpers
  const getChildren = (parentId: string | undefined) => {
    return categories
      .filter(c => parentId ? c.parent_id === parentId : !c.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  const finalCategoryId = categoryPath.length > 0
    ? categoryPath[categoryPath.length - 1].id
    : undefined;

  const getCategoryDisplay = () => {
    if (categoryPath.length === 0) return '';
    return categoryPath.map(p => p.name).join(' › ');
  };

  const currentLevelCategories = useMemo(() => {
    const parentId = categoryBrowseLevel === 0
      ? undefined
      : categoryPath[categoryBrowseLevel - 1]?.id;
    return getChildren(parentId);
  }, [categories, categoryBrowseLevel, categoryPath]);

  const selectedAtCurrentLevel = categoryPath[categoryBrowseLevel]?.id;

  const handleCategorySelect = (cat: MarketplaceCategory | null) => {
    if (!cat) {
      const newPath = categoryPath.slice(0, categoryBrowseLevel);
      setCategoryPath(newPath);
      setShowCategoryPicker(false);
      return;
    }

    const children = getChildren(cat.id);
    const newPath = [
      ...categoryPath.slice(0, categoryBrowseLevel),
      { id: cat.id, name: cat.name },
    ];
    setCategoryPath(newPath);

    if (children.length > 0) {
      setCategoryBrowseLevel(categoryBrowseLevel + 1);
    } else {
      setShowCategoryPicker(false);
    }
  };

  const handleBreadcrumbTap = (level: number) => {
    setCategoryBrowseLevel(level);
  };

  // Location helpers
  const getCountyName = () => {
    if (!countyId) return '';
    return counties.find(c => c.id === countyId)?.name || '';
  };

  const getMunicipalityName = () => {
    if (!municipalityId) return '';
    return municipalities.find(m => m.id === municipalityId)?.name || '';
  };

  // Compress image to max 1200px wide, JPEG quality 0.7
  const compressImage = async (uri: string): Promise<string> => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  };

  // Image handling
  const handleAddImages = async () => {
    if (images.length >= 5) {
      Alert.alert('Max bilder', 'Du kan ladda upp max 5 bilder.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 1, // Pick full quality, we compress ourselves
    });

    if (result.canceled || !result.assets) return;

    const newImages: ImageFile[] = [];
    for (const asset of result.assets) {
      try {
        const compressedUri = await compressImage(asset.uri);
        newImages.push({
          uri: compressedUri,
          id: `${Date.now()}-${Math.random()}`,
        });
      } catch (e) {
        console.error('Error compressing image:', e);
      }
    }

    setImages(prev => [...prev, ...newImages].slice(0, 5));
  };

  const handleRemoveImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  // Validation & Submission
  const validate = (): string | null => {
    if (!title.trim()) return 'Ange en rubrik.';
    if (!description.trim()) return 'Ange en beskrivning.';
    if (!finalCategoryId) return 'Välj en kategori.';
    if (transactionType !== 'give' && !price.trim()) return 'Ange ett pris.';
    if (!countyId) return 'Välj ett län.';
    if (!municipalityId) return 'Välj en kommun.';
    if (images.length === 0) return 'Ladda upp minst en bild.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!user || !activeOrganization || !finalCategoryId || !countyId || !municipalityId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const cityName = municipalities.find(m => m.id === municipalityId)?.name || null;

      const listingId = await createListing({
        organizationId: activeOrganization.id,
        categoryId: finalCategoryId,
        title: title.trim(),
        description: description.trim(),
        transactionType,
        price: transactionType === 'give' ? 0 : parseInt(price.replace(/\s/g, ''), 10),
        countyId,
        municipalityId,
        city: cityName,
        userId: user.id,
      });

      // Upload images sequentially
      for (let i = 0; i < images.length; i++) {
        await uploadListingImage({
          organizationId: activeOrganization.id,
          listingId,
          imageUri: images[i].uri,
          sortOrder: i,
        });
      }

      setCreatedListingId(listingId);
      setShowSuccess(true);
    } catch (err: any) {
      console.error('Error creating listing:', err);
      setError('Kunde inte skapa annonsen. Försök igen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transaction type tabs
  const transactionTypes: { label: string; value: TransactionType }[] = [
    { label: 'Sälj', value: 'sell' },
    { label: 'Bortskänkes', value: 'give' },
    { label: 'Köp', value: 'buy' },
  ];

  // ---- Render: Category Picker Modal ----
  const renderCategoryPicker = () => {
    const canGoBack = categoryBrowseLevel > 0;

    return (
      <Modal visible={showCategoryPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity
              onPress={() => {
                if (canGoBack) {
                  setCategoryBrowseLevel(categoryBrowseLevel - 1);
                } else {
                  setShowCategoryPicker(false);
                }
              }}
              style={styles.pickerBackBtn}
            >
              <ChevronLeft size={24} color={Colors.light.tint} />
              <Text style={styles.pickerBackText}>{canGoBack ? 'Tillbaka' : 'Avbryt'}</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Kategori</Text>
            <TouchableOpacity onPress={() => setShowCategoryPicker(false)} style={styles.pickerDoneBtn}>
              <Text style={styles.pickerDoneText}>Klar</Text>
            </TouchableOpacity>
          </View>

          {categoryPath.length > 0 && (
            <View style={styles.breadcrumbContainer}>
              <TouchableOpacity onPress={() => handleBreadcrumbTap(0)}>
                <Text style={[styles.breadcrumbText, categoryBrowseLevel === 0 && styles.breadcrumbActive]}>
                  Alla
                </Text>
              </TouchableOpacity>
              {categoryPath.map((crumb, index) => (
                <React.Fragment key={crumb.id}>
                  <Text style={styles.breadcrumbSeparator}>›</Text>
                  <TouchableOpacity onPress={() => handleBreadcrumbTap(index + 1)}>
                    <Text
                      style={[styles.breadcrumbText, categoryBrowseLevel === index + 1 && styles.breadcrumbActive]}
                      numberOfLines={1}
                    >
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
              categoryBrowseLevel > 0 ? (
                <TouchableOpacity style={styles.pickerItem} onPress={() => handleCategorySelect(null)}>
                  <Text style={[styles.pickerItemText, !selectedAtCurrentLevel && styles.pickerItemTextActive]}>
                    Alla i {categoryPath[categoryBrowseLevel - 1]?.name}
                  </Text>
                  {!selectedAtCurrentLevel && <Check size={20} color={Colors.light.tint} />}
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const hasChildren = getChildren(item.id).length > 0;
              const isSelected = selectedAtCurrentLevel === item.id;
              return (
                <TouchableOpacity style={styles.pickerItem} onPress={() => handleCategorySelect(item)}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                      {item.name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isSelected && !hasChildren && <Check size={20} color={Colors.light.tint} />}
                    {hasChildren && <ChevronRight size={20} color={isSelected ? Colors.light.tint : '#9ca3af'} />}
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>
    );
  };

  // ---- Render: Location Picker Modal ----
  const renderLocationPicker = (
    visible: boolean,
    onClose: () => void,
    title: string,
    data: any[],
    selectedId: string | undefined,
    onSelect: (item: any | null) => void
  ) => (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={onClose} style={styles.pickerBackBtn}>
            <ChevronLeft size={24} color={Colors.light.tint} />
            <Text style={styles.pickerBackText}>Tillbaka</Text>
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>{title}</Text>
          <View style={{ width: 80 }} />
        </View>
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.pickerItem}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <Text style={[styles.pickerItemText, selectedId === item.id && styles.pickerItemTextActive]}>
                {item.name}
              </Text>
              {selectedId === item.id && <Check size={20} color={Colors.light.tint} />}
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </Modal>
  );

  // ---- Render: Preview Modal ----
  const renderPreview = () => (
    <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.pickerBackBtn}>
            <X size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>Förhandsvisning</Text>
          <View style={{ width: 80 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {images.length > 0 ? (
            <Image source={{ uri: images[0].uri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={[styles.previewImage, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: '#9ca3af' }}>Ingen bild</Text>
            </View>
          )}

          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>
              {transactionType === 'sell' ? 'Säljes' : transactionType === 'buy' ? 'Köpes' : 'Skänkes'}
            </Text>
          </View>

          <Text style={styles.previewTitle}>{title || 'Ingen rubrik'}</Text>

          <Text style={styles.previewPrice}>
            {transactionType === 'give' ? 'Gratis' : price ? `${price} kr` : '0 kr'}
          </Text>

          {(getMunicipalityName() || getCountyName()) && (
            <View style={styles.previewLocation}>
              <Feather name="map-pin" size={14} color="#6b7280" />
              <Text style={styles.previewLocationText}>
                {[getMunicipalityName(), getCountyName()].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          <Text style={styles.previewDescription}>{description || 'Ingen beskrivning'}</Text>
        </ScrollView>
      </View>
    </Modal>
  );

  // ---- Render: Success Modal ----
  const renderSuccess = () => (
    <Modal visible={showSuccess} transparent animationType="fade">
      <View style={styles.successOverlay}>
        <View style={styles.successPopup}>
          <View style={styles.successIcon}>
            <Feather name="check" size={40} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Annons publicerad!</Text>
          <Text style={styles.successMessage}>Din annons är nu skapad och synlig för andra medlemmar.</Text>

          <TouchableOpacity
            style={styles.successPrimaryBtn}
            onPress={() => {
              setShowSuccess(false);
              if (createdListingId) {
                router.replace(`/listing/${createdListingId}`);
              }
            }}
          >
            <Text style={styles.successPrimaryText}>Se annons</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.successSecondaryBtn}
            onPress={() => {
              setShowSuccess(false);
              router.back();
            }}
          >
            <Text style={styles.successSecondaryText}>Tillbaka till listan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Skapa annons',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ paddingHorizontal: 8, paddingVertical: 4, marginLeft: -8, justifyContent: 'center', alignItems: 'center' }}
            >
              <Feather name="chevron-left" size={28} color={Colors.light.tint} />
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Transaction Type Tabs */}
          <View style={styles.tabContainer}>
            {transactionTypes.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.tab, transactionType === t.value && styles.tabActive]}
                onPress={() => setTransactionType(t.value)}
              >
                <Text style={[styles.tabText, transactionType === t.value && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBar}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <X size={18} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}

          {/* Form Card */}
          <View style={styles.card}>
            {/* Images */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Bilder *</Text>
              <Text style={styles.formHint}>Max 5 bilder</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
                {images.map((img) => (
                  <View key={img.id} style={styles.imageThumbnailWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.imageThumbnail} />
                    <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => handleRemoveImage(img.id)}>
                      <X size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 5 && (
                  <TouchableOpacity style={styles.imageAddBtn} onPress={handleAddImages}>
                    <Camera size={24} color="#9ca3af" />
                    <Text style={styles.imageAddText}>Lägg till</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {/* Category */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Kategori *</Text>
              <TouchableOpacity
                style={styles.selectorRow}
                onPress={() => {
                  setCategoryBrowseLevel(categoryPath.length);
                  setShowCategoryPicker(true);
                }}
              >
                <Text style={[styles.selectorValue, !finalCategoryId && styles.selectorPlaceholder]} numberOfLines={1}>
                  {finalCategoryId ? getCategoryDisplay() : 'Välj kategori'}
                </Text>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Rubrik *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Vad vill du annonsera?"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Description */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Beskrivning *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Beskriv varan, skick, etc..."
                value={description}
                onChangeText={setDescription}
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            {/* Price (hidden for give) */}
            {transactionType !== 'give' && (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Pris (kr) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            )}

            {/* Location */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Plats *</Text>
              <View style={styles.locationRow}>
                <TouchableOpacity
                  style={[styles.selectorRow, { flex: 1 }]}
                  onPress={() => setShowCountyPicker(true)}
                >
                  <View>
                    <Text style={styles.selectorLabel}>Län</Text>
                    <Text style={[styles.selectorValue, !countyId && styles.selectorPlaceholder]}>
                      {countyId ? getCountyName() : 'Välj'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.selectorRow, { flex: 1 }, !countyId && styles.disabledRow]}
                  onPress={() => countyId && setShowMunicipalityPicker(true)}
                  disabled={!countyId}
                >
                  <View>
                    <Text style={styles.selectorLabel}>Kommun</Text>
                    <Text style={[styles.selectorValue, !municipalityId && styles.selectorPlaceholder]}>
                      {municipalityId ? getMunicipalityName() : 'Välj'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.previewBtn} onPress={() => setShowPreview(true)}>
            <Eye size={18} color="#374151" />
            <Text style={styles.previewBtnText}>Förhandsvisning</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, (isSubmitting || !title || !finalCategoryId) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || !title || !finalCategoryId}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Plus size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Lägg in annons</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {renderCategoryPicker()}
      {renderLocationPicker(showCountyPicker, () => setShowCountyPicker(false), 'Välj län', counties, countyId, (item) => {
        setCountyId(item?.id);
        setMunicipalityId(undefined);
      })}
      {renderLocationPicker(showMunicipalityPicker, () => setShowMunicipalityPicker(false), 'Välj kommun', municipalities, municipalityId, (item) => {
        setMunicipalityId(item?.id);
      })}
      {renderPreview()}
      {renderSuccess()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    flex: 1,
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.light.tint,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  // Error
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  // Card
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  formHint: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8,
    marginTop: -4,
  },
  // Images
  imageRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  imageThumbnailWrapper: {
    position: 'relative',
  },
  imageThumbnail: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAddBtn: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imageAddText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  // Selectors
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
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
    flex: 1,
  },
  selectorPlaceholder: {
    color: '#9ca3af',
    fontWeight: '400',
  },
  disabledRow: {
    backgroundColor: '#f3f4f6',
    opacity: 0.7,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  // Text inputs
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 120,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  previewBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Picker modal
  pickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  pickerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  pickerBackText: {
    color: Colors.light.tint,
    fontSize: 16,
    marginLeft: 4,
  },
  pickerDoneBtn: {
    width: 80,
    alignItems: 'flex-end',
  },
  pickerDoneText: {
    color: Colors.light.tint,
    fontSize: 16,
    fontWeight: '600',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#374151',
  },
  pickerItemTextActive: {
    color: Colors.light.tint,
    fontWeight: '600',
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
  // Preview
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  previewBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  previewPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.tint,
    marginBottom: 12,
  },
  previewLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  previewLocationText: {
    fontSize: 14,
    color: '#6b7280',
  },
  previewDescription: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  // Success
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successPopup: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  successPrimaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    marginBottom: 10,
  },
  successPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  successSecondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  successSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
