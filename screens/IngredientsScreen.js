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

const IngredientsScreen = ({ branchId }) => {
  // State tanımlamaları
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' veya 'edit'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterApplied, setFilterApplied] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    unit: 'adet', // Varsayılan birim
    stock_level: '',
    low_stock_threshold: ''
  });

  const flatListRef = useRef(null);

  // Malzemeleri getir
  const fetchIngredients = async () => {
    if (!branchId) { // If no branchId is provided, don't fetch or show a message
      setIngredients([]);
      setLoading(false);
      setRefreshing(false);
      // Optionally, show an alert or message to select a branch
      // Alert.alert("Uyarı", "Lütfen bir şube seçin.");
      return;
    }

    try {
      setLoading(true);
      
      let query = supabase
        .from('ingredients')
        .select('*') // id, name, unit, stock_quantity, low_stock_threshold, created_at, updated_at
        .order('name'); // Alfabetik sırala

      // branchId'ye göre filtreleme, eğer Ingredients tablosunda branch_id varsa.
      // Mevcut şemada ingredients tablosunda doğrudan branch_id görünmüyor.
      // Eğer şube bazlı malzeme yönetimi varsa, bu sorgu veya tablo yapısı gözden geçirilmeli.
      // Şimdilik tüm malzemeleri çekiyoruz.
      // if (branchId) {
      //   query = query.eq('branch_id', branchId); 
      // }
      
      const { data, error, count } = await query; // `count` artık doğrudan kullanılmayacak

      if (error) throw error;
      
      if (data) {
        setIngredients(data);
        // setTotalCount(count || 0); // Kaldırıldı
      }
    } catch (error) {
      console.error('Malzemeler alınırken hata:', error);
      Alert.alert('Hata', 'Malzemeler yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
      // setLoadingMore(false); // Kaldırıldı
    }
  };

  // Sayfa değiştiğinde, pageSize veya arama sorgusu değiştiğinde veya branchId değiştiğinde malzemeleri tekrar getir
  useEffect(() => {
    if (branchId) { // Only fetch if branchId is available
      fetchIngredients();
    } else {
      setIngredients([]); // Clear ingredients if no branch is selected
      setLoading(false);
    }
  }, [branchId]);

  // Sayfayı yenile
  const onRefresh = () => {
    setRefreshing(true);
    fetchIngredients();
  };

  // Form alanlarını sıfırla
  const resetForm = () => {
    setFormData({
      id: null,
      name: '',
      unit: 'adet',
      stock_level: '',
      low_stock_threshold: ''
    });
  };

  // Düzenleme modunu başlat
  const startEdit = (item) => {
    setFormData({
      id: item.id,
      name: item.name,
      unit: item.unit,
      stock_level: item.stock_quantity.toString(),
      low_stock_threshold: item.low_stock_threshold.toString()
    });
    setFormMode('edit');
    setModalVisible(true);
  };

  // Malzeme ekle veya güncelle
  const handleSaveIngredient = async () => {
    // Form doğrulama
    if (!formData.name.trim()) {
      Alert.alert('Hata', 'Malzeme adı boş olamaz.');
      return;
    }

    if (!formData.stock_level.trim() || isNaN(Number(formData.stock_level))) {
      Alert.alert('Hata', 'Geçerli bir stok değeri girin.');
      return;
    }

    if (!formData.low_stock_threshold.trim() || isNaN(Number(formData.low_stock_threshold))) {
      Alert.alert('Hata', 'Geçerli bir düşük stok eşiği girin.');
      return;
    }

    try {
      setLoading(true);
      
      const now = new Date().toISOString();
      
      if (formMode === 'add') {
        // Yeni malzeme ekle
        const ingredientData = {
          name: formData.name.trim(),
          unit: formData.unit,
          stock_quantity: Number(formData.stock_level),
          low_stock_threshold: Number(formData.low_stock_threshold),
          created_at: now,
          updated_at: now
        };

        const { error } = await supabase
          .from('ingredients')
          .insert(ingredientData);
          
        if (error) throw error;
        
        Alert.alert('Başarılı', 'Malzeme başarıyla eklendi.');
      } else {
        // Mevcut malzemeyi güncelle
        const ingredientData = {
          name: formData.name.trim(),
          unit: formData.unit,
          stock_quantity: Number(formData.stock_level),
          low_stock_threshold: Number(formData.low_stock_threshold),
          updated_at: now
        };

        const { error } = await supabase
          .from('ingredients')
          .update(ingredientData)
          .eq('id', formData.id);
          
        if (error) throw error;
        
        Alert.alert('Başarılı', 'Malzeme başarıyla güncellendi.');
      }
      
      setModalVisible(false);
      resetForm();
      fetchIngredients();
      
    } catch (error) {
      console.error('Malzeme kaydedilirken hata:', error);
      Alert.alert('Hata', 'Malzeme kaydedilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Malzeme sil
  const handleDeleteIngredient = (item) => {
    Alert.alert(
      'Silme Onayı',
      `"${item.name}" malzemesini silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Malzemeyi sil
              const { error } = await supabase
                .from('ingredients')
                .delete()
                .eq('id', item.id);
                
              if (error) throw error;
              
              fetchIngredients();
              Alert.alert('Başarılı', 'Malzeme başarıyla silindi.');
              
            } catch (error) {
              console.error('Malzeme silinirken hata:', error);
              Alert.alert('Hata', 'Malzeme silinirken bir sorun oluştu.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Malzeme satırı render fonksiyonu
  const renderIngredientItem = ({ item }) => {
    const isLowStock = item.stock_quantity !== null && item.low_stock_threshold !== null && item.stock_quantity < item.low_stock_threshold;
    return (
      <View style={styles.tableRow}>
        <View style={styles.tableCell}>
          <Text style={styles.cellText}>{item.name}</Text>
        </View>
        <View style={[styles.tableCell, { flex: 0.6 }]}>
          <Text style={styles.cellText}>{item.unit}</Text>
        </View>
        <View style={[styles.tableCell, { flex: 0.6 }]}>
          <Text style={styles.cellText}>{item.stock_quantity}</Text>
        </View>
        <View style={[styles.tableCell, { flex: 0.7 }]}>
          <Text style={styles.cellText}>{item.low_stock_threshold}</Text>
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
              onPress={() => handleDeleteIngredient(item)}
            >
              <MaterialIcons name="delete" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Tablo başlığı render fonksiyonu
  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <View style={styles.tableHeaderCell}>
        <Text style={styles.tableHeaderText}>Ad</Text>
      </View>
      <View style={[styles.tableHeaderCell, { flex: 0.6 }]}>
        <Text style={styles.tableHeaderText}>Birim</Text>
      </View>
      <View style={[styles.tableHeaderCell, { flex: 0.6 }]}>
        <Text style={styles.tableHeaderText}>Stok</Text>
      </View>
      <View style={[styles.tableHeaderCell, { flex: 0.7 }]}>
        <Text style={styles.tableHeaderText}>Düşük Stok Eşiği</Text>
      </View>
      <View style={[styles.tableHeaderCell, { flex: 0.6 }]}>
        <Text style={styles.tableHeaderText}>İşlemler</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Malzemeler</Text>
        <View style={styles.headerActions}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Malzeme Ara..."
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setFilterApplied(!!text);
              }}
            />
            {searchQuery ? (
              <TouchableOpacity
                style={styles.clearSearch}
                onPress={() => {
                  setSearchQuery('');
                  setFilterApplied(false);
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
            <Text style={styles.addButtonText}>Yeni Malzeme Ekle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Malzemeler yükleniyor...</Text>
        </View>
      ) : (
        <>
          <View style={styles.tableContainer}>
            {renderTableHeader()}
            
            {ingredients.length === 0 ? (
              <View style={styles.noDataContainer}>
                <Ionicons name="information-circle-outline" size={50} color="#888" />
                <Text style={styles.noDataText}>
                  {filterApplied 
                    ? "Aranan kriterlere uygun malzeme bulunamadı." 
                    : "Henüz malzeme eklenmemiş."}
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
                data={ingredients}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderIngredientItem}
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
        </>
      )}

      {/* Malzeme Ekleme/Düzenleme Modal */}
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
              {formMode === 'add' ? 'Yeni Malzeme Ekle' : 'Malzeme Düzenle'}
            </Text>
            
            <ScrollView style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Malzeme Adı</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({...formData, name: text})}
                  placeholder="Malzeme adını girin"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Birim</Text>
                <View style={styles.unitSelectorContainer}>
                  {['adet', 'g', 'kg', 'ml', 'lt'].map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitButton,
                        formData.unit === unit && styles.activeUnitButton
                      ]}
                      onPress={() => setFormData({...formData, unit: unit})}
                    >
                      <Text 
                        style={[
                          styles.unitButtonText,
                          formData.unit === unit && styles.activeUnitButtonText
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.formRow}>
                <View style={[styles.formGroup, {flex: 1, marginRight: 10}]}>
                  <Text style={styles.formLabel}>Stok Miktarı</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.stock_level}
                    onChangeText={(text) => setFormData({...formData, stock_level: text})}
                    placeholder="Stok miktarını girin"
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={[styles.formGroup, {flex: 1}]}>
                  <Text style={styles.formLabel}>Düşük Stok Eşiği</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.low_stock_threshold}
                    onChangeText={(text) => setFormData({...formData, low_stock_threshold: text})}
                    placeholder="Uyarı eşiğini girin"
                    keyboardType="numeric"
                  />
                </View>
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
                onPress={handleSaveIngredient}
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
  formRow: {
    flexDirection: 'row',
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
  unitSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  unitButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  activeUnitButton: {
    backgroundColor: '#1e3a8a',
  },
  unitButtonText: {
    color: '#333',
  },
  activeUnitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
});

export default IngredientsScreen; 