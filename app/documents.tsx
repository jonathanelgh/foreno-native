import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '../constants/Colors';
import { getOrganizationDocuments, getOrganizationFolders, getDocumentUrl, createFolder, createDocument, deleteDocument, deleteFolder, moveDocument, moveFolder, Folder } from '../lib/api/documents';
import { useAuth } from '../contexts/AuthContext';
import { Document } from '../types/database';
import { uploadDocument, getMimeTypeFromFileName } from '../lib/storage';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';

type FolderItem = {
  type: 'folder';
  folder: Folder;
  documents: Document[];
  subfolders: FolderItem[];
  level: number;
};

type FileItem = {
  type: 'file';
  document: Document;
  level: number;
};

type ListItem = FolderItem | FileItem;

export default function DocumentsScreen() {
  const navRouter = useRouter();
  const { activeOrganization, loading: authLoading, isAdmin, isStyrelse, user, userRole } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuItem, setContextMenuItem] = useState<{ type: 'folder' | 'file'; item: Folder | Document } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const canManage = isAdmin || isStyrelse || userRole === 'owner';

  const loadDocuments = useCallback(async () => {
    if (!activeOrganization) {
      setLoading(false);
      return;
    }
    
    try {
      const [documentsData, foldersData] = await Promise.all([
        getOrganizationDocuments(activeOrganization.id),
        getOrganizationFolders(activeOrganization.id)
      ]);
      setDocuments(documentsData);
      setFolders(foldersData);
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Fel', 'Kunde inte ladda dokument');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    if (!authLoading) {
      loadDocuments();
      // Reset navigation when organization changes
      setCurrentFolderId(null);
      setFolderPath([]);
    }
  }, [authLoading, loadDocuments, activeOrganization?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments();
  };

  const getFileIcon = (fileType: string | null, fileName: string | null) => {
    const extension = fileName?.split('.').pop()?.toLowerCase() || '';
    
    if (fileType?.startsWith('image/')) {
      return 'image';
    }
    
    switch (extension) {
      case 'pdf':
        return 'file-text';
      case 'doc':
      case 'docx':
        return 'file-text';
      case 'xls':
      case 'xlsx':
        return 'file-text';
      case 'ppt':
      case 'pptx':
        return 'file-text';
      case 'txt':
        return 'file-text';
      case 'zip':
      case 'rar':
        return 'archive';
      default:
        return 'file';
    }
  };

  const getFileTypeColor = (fileType: string | null, fileName: string | null) => {
    const extension = fileName?.split('.').pop()?.toLowerCase() || '';
    
    if (fileType?.startsWith('image/')) {
      return '#10b981'; // Green for images
    }
    
    switch (extension) {
      case 'pdf':
        return '#ef4444'; // Red for PDFs
      case 'doc':
      case 'docx':
        return '#2563eb'; // Blue for Word
      case 'xls':
      case 'xlsx':
        return '#10b981'; // Green for Excel
      case 'ppt':
      case 'pptx':
        return '#f59e0b'; // Orange for PowerPoint
      default:
        return '#6b7280'; // Gray for others
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Idag';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Igår';
    } else {
      const monthNames = [
        'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
        'jul', 'aug', 'sep', 'okt', 'nov', 'dec'
      ];
      return `${date.getDate()} ${monthNames[date.getMonth()]}`;
    }
  };

  const getCurrentFolderPath = (folderId: string | null, allFolders: Folder[]): Folder[] => {
    if (!folderId) return [];
    
    const path: Folder[] = [];
    let currentId: string | null = folderId;
    
    while (currentId) {
      const folder = allFolders.find(f => f.id === currentId);
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.parent_folder_id;
    }
    
    return path;
  };

  const organizeDocuments = (allFolders: Folder[], allDocuments: Document[], parentFolderId: string | null): ListItem[] => {
    const items: ListItem[] = [];
    
    // Get folders in current directory
    const currentFolders = allFolders
      .filter(f => f.parent_folder_id === parentFolderId)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Add folders
    currentFolders.forEach(folder => {
      // Count documents directly in this folder
      const folderDocuments = allDocuments.filter(d => d.folder_id === folder.id);
      // Count subfolders
      const subfolderCount = allFolders.filter(f => f.parent_folder_id === folder.id).length;
      items.push({
        type: 'folder',
        folder,
        documents: folderDocuments,
        subfolders: [],
        level: 0,
      });
    });

    // Add documents in current directory
    const currentDocuments = allDocuments
      .filter(d => d.folder_id === parentFolderId)
      .sort((a, b) => {
        const nameA = (a.title || a.file_name || '').toLowerCase();
        const nameB = (b.title || b.file_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      })
      .map(doc => ({
        type: 'file' as const,
        document: doc,
        level: 0,
      }));

    items.push(...currentDocuments);

    return items;
  };

  const handleFolderPress = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    const path = getCurrentFolderPath(folder.id, folders);
    setFolderPath(path);
  };

  const handleBreadcrumbPress = (index: number) => {
    if (index === -1) {
      // Navigate to root
      setCurrentFolderId(null);
      setFolderPath([]);
    } else {
      // Navigate to folder at index
      const targetFolder = folderPath[index];
      setCurrentFolderId(targetFolder.id);
      setFolderPath(folderPath.slice(0, index + 1));
    }
  };

  const handleBackPress = () => {
    if (folderPath.length > 0) {
      // Navigate to parent folder
      const parentPath = folderPath.slice(0, -1);
      if (parentPath.length > 0) {
        const parentFolder = parentPath[parentPath.length - 1];
        setCurrentFolderId(parentFolder.id);
        setFolderPath(parentPath);
      } else {
        // Navigate to root
        setCurrentFolderId(null);
        setFolderPath([]);
      }
    }
  };

  const handleCreateFolder = async () => {
    if (!activeOrganization || !user) return;
    
    if (!newFolderName || !newFolderName.trim()) {
      Alert.alert('Fel', 'Mappnamn krävs');
      return;
    }

    try {
      await createFolder(
        activeOrganization.id,
        newFolderName.trim(),
        currentFolderId,
        user.id
      );
      setShowCreateFolderModal(false);
      setNewFolderName('');
      setShowActionModal(false);
      loadDocuments();
      Alert.alert('Framgång', 'Mappen har skapats');
    } catch (error) {
      console.error('Error creating folder:', error);
      Alert.alert('Fel', 'Kunde inte skapa mappen');
    }
  };

  const handleUploadFile = async () => {
    if (!activeOrganization || !user) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setShowActionModal(false);
        return;
      }

      const file = result.assets[0];
      if (!file) return;

      // Upload file to storage
      const uploadResult = await uploadDocument(
        file.uri,
        'documents',
        file.name,
        activeOrganization.id,
        file.mimeType
      );

      // Get mime type for document record
      const mimeType = file.mimeType || getMimeTypeFromFileName(file.name);

      // Create document record
      await createDocument(
        activeOrganization.id,
        uploadResult.path,
        file.name,
        file.size || 0,
        mimeType,
        currentFolderId,
        user.id
      );

      setShowActionModal(false);
      loadDocuments();
      Alert.alert('Framgång', 'Filen har laddats upp');
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Fel', 'Kunde inte ladda upp filen');
    }
  };

  const handleDocumentPress = (document: Document) => {
    if (!document.file_url && !document.file_path) {
      Alert.alert('Fel', 'Ingen fil-URL tillgänglig');
      return;
    }

    setPreviewDocument(document);
    setShowPreview(true);
  };

  const handleContextMenuPress = (type: 'folder' | 'file', item: Folder | Document, layout: { x: number; y: number; width: number; height: number }) => {
    // Position dropdown aligned to the right edge of the button
    const dropdownWidth = 160;
    setContextMenuPosition({ 
      x: layout.x + layout.width - dropdownWidth, 
      y: layout.y + layout.height + 4 
    });
    setContextMenuItem({ type, item });
    setShowContextMenu(true);
  };

  const handleDelete = async () => {
    if (!contextMenuItem) return;

    const { type, item } = contextMenuItem;

    if (type === 'folder') {
      const folder = item as Folder;
      // Check if folder has files or subfolders
      const folderDocuments = documents.filter(d => d.folder_id === folder.id);
      const subfolders = folders.filter(f => f.parent_folder_id === folder.id);
      
      if (folderDocuments.length > 0 || subfolders.length > 0) {
        Alert.alert('Fel', 'Kan inte radera mapp som innehåller filer eller undermappar');
        return;
      }

      Alert.alert(
        'Radera mapp',
        `Är du säker på att du vill radera "${folder.name}"?`,
        [
          { text: 'Avbryt', style: 'cancel' },
          {
            text: 'Radera',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteFolder(folder.id);
                loadDocuments();
                Alert.alert('Framgång', 'Mappen har raderats');
              } catch (error) {
                console.error('Error deleting folder:', error);
                Alert.alert('Fel', 'Kunde inte radera mappen');
              }
            },
          },
        ]
      );
    } else {
      const document = item as Document;
      Alert.alert(
        'Radera fil',
        `Är du säker på att du vill radera "${document.title || document.file_name}"?`,
        [
          { text: 'Avbryt', style: 'cancel' },
          {
            text: 'Radera',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteDocument(document.id);
                loadDocuments();
                Alert.alert('Framgång', 'Filen har raderats');
              } catch (error) {
                console.error('Error deleting document:', error);
                Alert.alert('Fel', 'Kunde inte radera filen');
              }
            },
          },
        ]
      );
    }
  };

  const handleMove = () => {
    // TODO: Implement move functionality with folder picker
    Alert.alert('Info', 'Flytta-funktionen kommer snart');
  };

  const renderFileItem = (item: FileItem) => {
    const { document, level } = item;
    const fileName = document.title || document.file_name || 'Namnlöst dokument';
    const fileSize = formatFileSize(document.file_size);
    const uploadDate = formatDate(document.uploaded_at);
    const iconName = getFileIcon(document.file_type, document.file_name);
    const iconColor = getFileTypeColor(document.file_type, document.file_name);

    return (
      <TouchableOpacity
        style={[styles.documentItem, level > 0 && { paddingLeft: 16 + level * 16 }]}
        onPress={() => handleDocumentPress(document)}
      >
        <View style={[styles.documentIcon, { backgroundColor: iconColor + '15' }]}>
          <Feather name={iconName as any} size={22} color={iconColor} />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={styles.documentMeta}>
            {fileSize && (
              <Text style={styles.documentMetaText}>{fileSize}</Text>
            )}
            {fileSize && uploadDate && (
              <Text style={styles.documentMetaSeparator}> • </Text>
            )}
            {uploadDate && (
              <Text style={styles.documentMetaText}>{uploadDate}</Text>
            )}
          </View>
        </View>
        {canManage ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              const target = e.currentTarget;
              target.measure((x, y, width, height, pageX, pageY) => {
                handleContextMenuPress('file', document, { x: pageX, y: pageY, width, height });
              });
            }}
            style={styles.contextMenuButton}
          >
            <Feather name="more-vertical" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ) : (
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        )}
      </TouchableOpacity>
    );
  };

  const renderFolderItem = (item: FolderItem) => {
    const { folder, documents } = item;
    const subfolderCount = folders.filter(f => f.parent_folder_id === folder.id).length;
    const totalCount = documents.length + subfolderCount;

    return (
      <TouchableOpacity
        style={styles.folderItem}
        onPress={() => handleFolderPress(folder)}
      >
        <View style={styles.folderIcon}>
          <Feather 
            name="folder" 
            size={22} 
            color="#f59e0b" 
          />
        </View>
        <View style={styles.folderInfo}>
          <Text style={styles.folderName} numberOfLines={1}>
            {folder.name}
          </Text>
          <Text style={styles.folderMeta}>
            {totalCount} {totalCount === 1 ? 'objekt' : 'objekt'}
          </Text>
        </View>
        {canManage ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              const target = e.currentTarget;
              target.measure((x, y, width, height, pageX, pageY) => {
                handleContextMenuPress('folder', folder, { x: pageX, y: pageY, width, height });
              });
            }}
            style={styles.contextMenuButton}
          >
            <Feather name="more-vertical" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ) : (
          <Feather 
            name="chevron-right" 
            size={18} 
            color="#9ca3af" 
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'folder') {
      return renderFolderItem(item);
    } else {
      return renderFileItem(item);
    }
  };

  const renderContent = () => {
    if (authLoading || loading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.stateText}>Laddar dokument...</Text>
        </View>
      );
    }

    if (!activeOrganization) {
      return (
        <View style={styles.stateContainer}>
          <Feather name="folder" size={56} color="#9ca3af" />
          <Text style={styles.stateTitle}>Ingen organisation vald</Text>
          <Text style={styles.stateDescription}>
            Du måste vara medlem i en organisation för att se dokument.
          </Text>
        </View>
      );
    }

    const organizedItems = organizeDocuments(folders, documents, currentFolderId);

    if (organizedItems.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Feather name="folder" size={56} color="#9ca3af" />
          <Text style={styles.stateTitle}>Tom mapp</Text>
          <Text style={styles.stateDescription}>
            Denna mapp innehåller inga dokument eller undermappar.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={organizedItems}
        renderItem={renderListItem}
        keyExtractor={(item) => item.type === 'folder' ? `folder-${item.folder.id}` : `file-${item.document.id}`}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderBreadcrumbs = () => {
    if (folderPath.length === 0) {
      return (
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {activeOrganization?.name}
        </Text>
      );
    }

    return (
      <View style={styles.breadcrumbContainer}>
        <TouchableOpacity onPress={() => handleBreadcrumbPress(-1)}>
          <Text style={styles.breadcrumbItem}>{activeOrganization?.name}</Text>
        </TouchableOpacity>
        {folderPath.map((folder, index) => (
          <View key={folder.id} style={styles.breadcrumbSeparator}>
            <Feather name="chevron-right" size={12} color="#64748b" />
            <TouchableOpacity onPress={() => handleBreadcrumbPress(index)}>
              <Text style={styles.breadcrumbItem}>{folder.name}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: 'Dokument',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                if (currentFolderId) {
                  handleBackPress();
                } else {
                  navRouter.back();
                }
              }}
              style={{ paddingHorizontal: 8, paddingVertical: 4, marginLeft: -8, justifyContent: 'center', alignItems: 'center' }}
            >
              <Feather name="chevron-left" size={28} color={Colors.light.tint} />
            </TouchableOpacity>
          ),
        }}
      />
      {/* Breadcrumbs below header */}
      {currentFolderId && (
        <View style={styles.breadcrumbBar}>
          {renderBreadcrumbs()}
        </View>
      )}

      <View style={styles.content}>{renderContent()}</View>

      {/* Floating Action Button */}
      {(isAdmin || isStyrelse) && (
        <>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowActionModal(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Action Modal */}
          <Modal
            visible={showActionModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowActionModal(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowActionModal(false)}
            >
              <View style={styles.modalContent}>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setShowActionModal(false);
                    setShowCreateFolderModal(true);
                  }}
                >
                  <View style={styles.modalOptionIcon}>
                    <Feather name="folder" size={24} color="#2563eb" />
                  </View>
                  <Text style={styles.modalOptionText}>Skapa ny mapp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={handleUploadFile}
                >
                  <View style={styles.modalOptionIcon}>
                    <Feather name="upload" size={24} color="#2563eb" />
                  </View>
                  <Text style={styles.modalOptionText}>Ladda upp fil</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowActionModal(false)}
                >
                  <Text style={styles.modalCancelText}>Avbryt</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Create Folder Modal */}
          <Modal
            visible={showCreateFolderModal}
            transparent
            animationType="slide"
            onRequestClose={() => {
              setShowCreateFolderModal(false);
              setNewFolderName('');
            }}
          >
            <View style={styles.createFolderOverlay}>
              <View style={styles.createFolderModal}>
                <View style={styles.createFolderHeader}>
                  <Text style={styles.createFolderTitle}>Skapa ny mapp</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowCreateFolderModal(false);
                      setNewFolderName('');
                    }}
                  >
                    <Feather name="x" size={24} color="#374151" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.createFolderInput}
                  placeholder="Ange mappnamn"
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  autoFocus
                />
                <View style={styles.createFolderActions}>
                  <TouchableOpacity
                    style={styles.createFolderCancelButton}
                    onPress={() => {
                      setShowCreateFolderModal(false);
                      setNewFolderName('');
                    }}
                  >
                    <Text style={styles.createFolderCancelText}>Avbryt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.createFolderButton}
                    onPress={handleCreateFolder}
                  >
                    <Text style={styles.createFolderButtonText}>Skapa</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}

      {/* Context Menu Dropdown */}
      {showContextMenu && contextMenuItem && contextMenuPosition && (
        <>
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowContextMenu(false);
              setContextMenuItem(null);
              setContextMenuPosition(null);
            }}
          />
          <View
            style={[
              styles.contextMenuDropdown,
              {
                top: contextMenuPosition.y,
                left: contextMenuPosition.x,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.contextMenuOption}
              onPress={() => {
                handleMove();
                setShowContextMenu(false);
                setContextMenuItem(null);
                setContextMenuPosition(null);
              }}
            >
              <View style={styles.contextMenuOptionIcon}>
                <Feather name="corner-up-right" size={18} color="#2563eb" />
              </View>
              <Text style={styles.contextMenuOptionText}>Flytta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.contextMenuOption,
                contextMenuItem.type === 'folder' && 
                (documents.filter(d => d.folder_id === (contextMenuItem.item as Folder).id).length > 0 ||
                 folders.filter(f => f.parent_folder_id === (contextMenuItem.item as Folder).id).length > 0) &&
                styles.contextMenuOptionDisabled
              ]}
              onPress={() => {
                if (
                  contextMenuItem.type === 'folder' &&
                  (documents.filter(d => d.folder_id === (contextMenuItem.item as Folder).id).length > 0 ||
                   folders.filter(f => f.parent_folder_id === (contextMenuItem.item as Folder).id).length > 0)
                ) {
                  return;
                }
                handleDelete();
                setShowContextMenu(false);
                setContextMenuItem(null);
                setContextMenuPosition(null);
              }}
              disabled={
                contextMenuItem.type === 'folder' &&
                (documents.filter(d => d.folder_id === (contextMenuItem.item as Folder).id).length > 0 ||
                 folders.filter(f => f.parent_folder_id === (contextMenuItem.item as Folder).id).length > 0)
              }
            >
              <View style={styles.contextMenuOptionIcon}>
                <Feather name="trash-2" size={18} color="#ef4444" />
              </View>
              <Text style={[
                styles.contextMenuOptionText,
                contextMenuItem.type === 'folder' &&
                (documents.filter(d => d.folder_id === (contextMenuItem.item as Folder).id).length > 0 ||
                 folders.filter(f => f.parent_folder_id === (contextMenuItem.item as Folder).id).length > 0) &&
                styles.contextMenuOptionTextDisabled
              ]}>
                Radera
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        visible={showPreview}
        document={previewDocument}
        onClose={() => {
          setShowPreview(false);
          setPreviewDocument(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  breadcrumbBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: '#64748b',
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  breadcrumbSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  breadcrumbItem: {
    fontSize: 14,
    color: '#2563eb',
    marginLeft: 4,
    textDecorationLine: 'underline',
  },
  content: {
    flex: 1,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  stateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  stateTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  stateDescription: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  listContainer: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentMetaText: {
    fontSize: 13,
    color: '#64748b',
  },
  documentMetaSeparator: {
    fontSize: 13,
    color: '#9ca3af',
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  folderIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    backgroundColor: '#fef3c7',
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  folderMeta: {
    fontSize: 13,
    color: '#64748b',
  },
  folderContent: {
    marginLeft: 16,
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90, // Above the tab bar
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  modalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalCancel: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  createFolderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  createFolderModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  createFolderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  createFolderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  createFolderInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 20,
  },
  createFolderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  createFolderCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  createFolderCancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  createFolderButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createFolderButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  contextMenuButton: {
    padding: 4,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  contextMenuDropdown: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  contextMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contextMenuOptionDisabled: {
    opacity: 0.5,
  },
  contextMenuOptionIcon: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  contextMenuOptionText: {
    fontSize: 16,
    color: '#1f2937',
  },
  contextMenuOptionTextDisabled: {
    color: '#9ca3af',
  },
  contextMenuCancel: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  contextMenuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
});


