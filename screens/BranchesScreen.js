import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput, 
  Modal, 
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  RefreshControl
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';

const BranchesScreen = () => {
  // State tanımlamaları
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' veya 'edit'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterApplied, setFilterApplied] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    address: '',
    phone: ''
  });

  // State for delete confirmation modal
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  const flatListRef = useRef(null);

  // Şubeleri getir
  const fetchBranches = async () => {
    try {
      setLoading(true);
      
      // Toplam şube sayısını almak için sorgu
      const { count, error: countError } = await supabase
        .from('branches')
        .select('*', { count: 'exact', head: true });
        
      if (countError) throw countError;
      
      // Toplam sayfa sayısını hesapla
      setTotalCount(count);
      setTotalPages(Math.ceil(count / pageSize));
      
      // Şubeleri getir
      let query = supabase
        .from('branches')
        .select('*');
        
      // Arama filtresi
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`);
      }
      
      // Sayfalama
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await query
        .range(from, to)
        .order('name');
      
      if (error) throw error;
      
      console.log(`${data.length} şube yüklendi.`);
      setBranches(data || []);
      
    } catch (error) {
      console.error('Şube verisi çekilirken hata:', error);
      Alert.alert('Hata', 'Şubeler yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Sayfa değiştiğinde veya filtre uygulandığında şubeleri tekrar getir
  useEffect(() => {
    fetchBranches();
  }, [currentPage, pageSize, searchQuery]);

  // Sayfayı yenile
  const onRefresh = () => {
    setRefreshing(true);
    fetchBranches();
  };

  // Form alanlarını sıfırla
  const resetForm = () => {
    setFormData({
      id: null,
      name: '',
      address: '',
      phone: ''
    });
  };

  // Düzenleme modunu başlat
  const startEdit = (item) => {
    setFormData({
      id: item.id,
      name: item.name || '',
      address: item.address || '',
      phone: item.phone_number || ''
    });
    setFormMode('edit');
    setModalVisible(true);
  };

  // Şube ekle veya güncelle
  const handleSaveBranch = async () => {
    // Form doğrulama
    if (!formData.name.trim()) {
      Alert.alert('Hata', 'Şube adı boş olamaz.');
      return;
    }

    try {
      setLoading(true);
      
      const branchData = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        phone_number: formData.phone.trim()
      };

      if (formMode === 'add') {
        // Yeni şube ekle
        const { error } = await supabase
          .from('branches')
          .insert(branchData);
          
        if (error) throw error;
        
        Alert.alert('Başarılı', 'Şube başarıyla eklendi.');
      } else {
        // Mevcut şubeyi güncelle
        const { error } = await supabase
          .from('branches')
          .update(branchData)
          .eq('id', formData.id);
          
        if (error) throw error;
        
        Alert.alert('Başarılı', 'Şube başarıyla güncellendi.');
      }
      
      setModalVisible(false);
      resetForm();
      fetchBranches();
      
    } catch (error) {
      console.error('Şube kaydedilirken hata:', error);
      Alert.alert('Hata', 'Şube kaydedilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Şube sil (deletion process starts here)
  const handleDeleteBranch = (item) => {
    setBranchToDelete(item); // Store the item to be deleted
    setDeleteConfirmInput(''); // Reset confirmation input
    setShowDeleteConfirmModal(true); // Show the custom confirmation modal
  };

  // Şubeyi gerçekten sil (actual deletion logic)
  const executeDeleteBranch = async () => {
    if (!branchToDelete || deleteConfirmInput !== branchToDelete.name) {
      Alert.alert('Hata', 'Silme işlemi için girilen şube adı yanlış.');
      return;
    }

    try {
      setLoading(true);
      
      // İlişkili verileri kontrol et
      const { count: inventoryCount, error: inventoryError } = await supabase
        .from('inventory')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchToDelete.id);
        
      if (inventoryError) throw inventoryError;
      
      const { count: salesCount, error: salesError } = await supabase
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchToDelete.id);
        
      if (salesError) throw salesError;
      
      if (inventoryCount > 0 || salesCount > 0) {
        Alert.alert(
          'Şube Silinemez',
          'Bu şubeye ait satış veya stok kayıtları bulunduğu için silinemez. Önce ilgili kayıtları silmelisiniz.'
        );
        setShowDeleteConfirmModal(false); // Hide modal on failure
        setBranchToDelete(null);
        return;
      }
      
      // Şubeyi sil
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchToDelete.id);
        
      if (error) throw error;
      
      fetchBranches(); // Refresh list
      Alert.alert('Başarılı', 'Şube başarıyla silindi.');
      
    } catch (error) {
      console.error('Şube silinirken hata:', error);
      Alert.alert('Hata', 'Şube silinirken bir sorun oluştu.');
    } finally {
      setLoading(false);
      setShowDeleteConfirmModal(false);
      setBranchToDelete(null);
      setDeleteConfirmInput('');
    }
  };

  // Sayfalama fonksiyonları
  const goToPage = (page) => {
    if (page >= 0 && page < totalPages) {
      setCurrentPage(page);
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  };

  const goToPreviousPage = () => {
    goToPage(currentPage - 1);
  };

  const goToNextPage = () => {
    goToPage(currentPage + 1);
  };

  // Şube satırı render fonksiyonu
  const renderBranchItem = ({ item }) => (
    <View style={styles.tableRow}>
      <View style={styles.tableCell}>
        <Text style={styles.cellText}>{item.name}</Text>
      </View>
      {/* Kaldırılan adres bölümü 
      <View style={[styles.tableCell, { flex: 1.5 }]}>
        <Text style={styles.cellText}>{item.address || '-'}</Text>
      </View>
      */}
      <View style={[styles.tableCell, { flex: 1 }]}>
        <Text style={styles.cellText}>{item.phone_number || '-'}</Text>
      </View>
      <View style={[styles.tableCell, { flex: 0.6, justifyContent: 'center' }]}>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => startEdit(item)}
          >
            <MaterialIcons name="edit" size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteBranch(item)}
          >
            <MaterialIcons name="delete" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Tablo başlığı render fonksiyonu
  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <View style={styles.tableHeaderCell}>
        <Text style={styles.tableHeaderText}>Şube Adı</Text>
      </View>
      {/* Kaldırılan adres başlığı
      <View style={[styles.tableHeaderCell, { flex: 1.5 }]}>
        <Text style={styles.tableHeaderText}>Adres</Text>
      </View>
      */}
      <View style={[styles.tableHeaderCell, { flex: 1 }]}>
        <Text style={styles.tableHeaderText}>Telefon</Text>
      </View>
      <View style={[styles.tableHeaderCell, { flex: 0.6 }]}>
        <Text style={styles.tableHeaderText}>İşlemler</Text>
      </View>
    </View>
  );

  // Sayfalama kontrollerini render et
  const renderPaginationControls = () => (
    <View style={styles.paginationContainer}>
      <View style={styles.paginationInfo}>
        <Text style={styles.paginationText}>
          Toplam {totalCount} şube 
        </Text>
      </View>
      <View style={styles.pageControls}>
        <TouchableOpacity 
          style={[styles.pageButton, currentPage === 0 && styles.disabledButton]}
          onPress={goToPreviousPage}
          disabled={currentPage === 0}
        >
          <MaterialIcons name="chevron-left" size={24} color={currentPage === 0 ? "#999" : "#fff"} />
        </TouchableOpacity>
        
        <View style={styles.pageIndicator}>
          <Text style={styles.pageIndicatorText}>
            Sayfa {currentPage + 1} / {totalPages}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.pageButton, currentPage === totalPages - 1 && styles.disabledButton]}
          onPress={goToNextPage}
          disabled={currentPage === totalPages - 1}
        >
          <MaterialIcons name="chevron-right" size={24} color={currentPage === totalPages - 1 ? "#999" : "#fff"} />
        </TouchableOpacity>
      </View>
      <View style={styles.pageSizeSelector}>
        <Text style={styles.pageSizeLabel}>Sayfa Başına:</Text>
        <TouchableOpacity
          style={[styles.pageSizeButton, pageSize === 5 && styles.activePageSizeButton]}
          onPress={() => {
            setPageSize(5);
            setCurrentPage(0);
          }}
        >
          <Text style={[styles.pageSizeButtonText, pageSize === 5 && styles.activePageSizeButtonText]}>5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pageSizeButton, pageSize === 10 && styles.activePageSizeButton]}
          onPress={() => {
            setPageSize(10);
            setCurrentPage(0);
          }}
        >
          <Text style={[styles.pageSizeButtonText, pageSize === 10 && styles.activePageSizeButtonText]}>10</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pageSizeButton, pageSize === 20 && styles.activePageSizeButton]}
          onPress={() => {
            setPageSize(20);
            setCurrentPage(0);
          }}
        >
          <Text style={[styles.pageSizeButtonText, pageSize === 20 && styles.activePageSizeButtonText]}>20</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Şubeler</Text>
        <View style={styles.headerActions}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Şube Ara..."
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setCurrentPage(0);
                setFilterApplied(!!text);
              }}
            />
            {searchQuery ? (
              <TouchableOpacity
                style={styles.clearSearch}
                onPress={() => {
                  setSearchQuery('');
                  setFilterApplied(false);
                  setCurrentPage(0);
                }}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setFormMode('add');
              setModalVisible(true);
            }}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Yeni Şube Ekle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Şubeler yükleniyor...</Text>
        </View>
      ) : (
        <>
          <View style={styles.tableContainer}>
            {renderTableHeader()}
            
            {branches.length === 0 ? (
              <View style={styles.noDataContainer}>
                <Ionicons name="information-circle-outline" size={50} color="#888" />
                <Text style={styles.noDataText}>
                  {filterApplied 
                    ? "Aranan kriterlere uygun şube bulunamadı." 
                    : "Henüz şube eklenmemiş."}
                </Text>
                {filterApplied && (
                  <TouchableOpacity
                    style={styles.clearFilterButton}
                    onPress={() => {
                      setSearchQuery('');
                      setFilterApplied(false);
                    }}
                  >
                    <Text style={styles.clearFilterButtonText}>Filtreyi Temizle</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={branches}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderBranchItem}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={["#1e3a8a"]}
                    tintColor="#1e3a8a"
                  />
                }
              />
            )}
          </View>
          
          {/* Sayfalama Kontrolleri */}
          {totalPages > 1 && renderPaginationControls()}
        </>
      )}

      {/* Şube Ekleme/Düzenleme Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {formMode === 'add' ? 'Yeni Şube Ekle' : 'Şube Düzenle'}
            </Text>
            
            <ScrollView style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Şube Adı</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({...formData, name: text})}
                  placeholder="Şube adını girin"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Adres</Text>
                <TextInput
                  style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                  value={formData.address}
                  onChangeText={(text) => setFormData({...formData, address: text})}
                  placeholder="Şube adresini girin"
                  multiline
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Telefon</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({...formData, phone: text})}
                  placeholder="Telefon numarasını girin"
                  keyboardType="phone-pad"
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveBranch}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showDeleteConfirmModal}
        onRequestClose={() => {
          setShowDeleteConfirmModal(false);
          setBranchToDelete(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.deleteConfirmContainer}
        >
          <View style={styles.deleteConfirmContent}>
            <Text style={styles.deleteConfirmTitle}>Şube Silme Onayı</Text>
            <Text style={styles.deleteConfirmText}>
              Lütfen silmek istediğiniz "<Text style={{fontWeight: 'bold'}}>{branchToDelete?.name}</Text>" şubesinin adını aşağıya birebir aynı şekilde yazarak onaylayın.
            </Text>
            <TextInput
              style={styles.deleteConfirmInput}
              placeholder="Şube adını buraya girin"
              value={deleteConfirmInput}
              onChangeText={(text) => setDeleteConfirmInput(text)}
              autoCapitalize="none"
            />
            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeleteConfirmModal(false);
                  setBranchToDelete(null);
                  setDeleteConfirmInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmButton, 
                  styles.deleteButton,
                  (deleteConfirmInput !== branchToDelete?.name || loading) && styles.disabledButton
                ]}
                onPress={executeDeleteBranch}
                disabled={deleteConfirmInput !== branchToDelete?.name || loading}
              >
                {loading && branchToDelete && deleteConfirmInput === branchToDelete.name ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Sil</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginRight: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#333',
  },
  clearSearch: {
    padding: 5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  tableContainer: {
    flex: 1,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  tableHeaderCell: {
    flex: 1,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
  },
  cellText: {
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  editButton: {
    backgroundColor: '#4c6ef5',
  },
  deleteButton: {
    backgroundColor: '#e53935',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  noDataText: {
    marginTop: 10,
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  clearFilterButton: {
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  clearFilterButtonText: {
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: Platform.OS === 'web' ? '60%' : '90%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  formContainer: {
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    margin: 10,
  },
  paginationInfo: {
    flex: 1,
  },
  paginationText: {
    color: '#fff',
    fontSize: 14,
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  pageButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  pageIndicator: {
    paddingHorizontal: 15,
  },
  pageIndicatorText: {
    color: '#fff',
    fontSize: 14,
  },
  pageSizeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  pageSizeLabel: {
    color: '#fff',
    marginRight: 10,
  },
  pageSizeButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginLeft: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
  },
  activePageSizeButton: {
    backgroundColor: '#fff',
  },
  pageSizeButtonText: {
    color: '#fff',
  },
  activePageSizeButtonText: {
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  deleteConfirmContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  deleteConfirmContent: {
    width: Platform.OS === 'web' ? '60%' : '90%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  deleteConfirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  deleteConfirmText: {
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  deleteConfirmInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 20,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default BranchesScreen; 