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
  RefreshControl,
  Switch
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';

const PaymentsScreen = () => {
  // State tanımlamaları
  const [paymentMethods, setPaymentMethods] = useState([]);
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
    description: '',
    is_active: true,
  });

  const flatListRef = useRef(null);

  // Ödeme yöntemlerini getir
  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
            
      // Ödeme yöntemlerini getir
      let query = supabase
        .from('payment_methods')
        .select('*');
        
      // Arama filtresi
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }
            
      const { data, error } = await query
        .order('name');
      
      if (error) throw error;
      
      console.log(`${data.length} ödeme yöntemi yüklendi.`);
      setPaymentMethods(data || []);
      
    } catch (error) {
      console.error('Ödeme yöntemleri verisi çekilirken hata:', error);
      Alert.alert('Hata', 'Ödeme yöntemleri yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filtre uygulandığında ödeme yöntemlerini tekrar getir
  useEffect(() => {
    fetchPaymentMethods();
  }, [searchQuery]);

  // Sayfayı yenile
  const onRefresh = () => {
    setRefreshing(true);
    fetchPaymentMethods();
  };

  // Form alanlarını sıfırla
  const resetForm = () => {
    setFormData({
      id: null,
      name: '',
      description: '',
      is_active: true,
    });
  };

  // Düzenleme modunu başlat
  const startEdit = (item) => {
    setFormData({
      id: item.id,
      name: item.name || '',
      description: item.description || '',
      is_active: item.is_active !== false,
    });
    setFormMode('edit');
    setModalVisible(true);
  };

  // Ödeme yöntemi ekle veya güncelle
  const handleSavePaymentMethod = async () => {
    // Form doğrulama
    if (!formData.name.trim()) {
      Alert.alert('Hata', 'Ödeme yöntemi adı boş olamaz.');
      return;
    }

    try {
      setLoading(true);
      
      const paymentData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_active: formData.is_active,
      };

      if (formMode === 'add') {
        // Yeni ödeme yöntemi ekle
        const { error } = await supabase
          .from('payment_methods')
          .insert(paymentData);
          
        if (error) throw error;
        
        Alert.alert('Başarılı', 'Ödeme yöntemi başarıyla eklendi.');
      } else {
        // Mevcut ödeme yöntemini güncelle
        const { error } = await supabase
          .from('payment_methods')
          .update(paymentData)
          .eq('id', formData.id);
          
        if (error) throw error;
        
        Alert.alert('Başarılı', 'Ödeme yöntemi başarıyla güncellendi.');
      }
      
      setModalVisible(false);
      resetForm();
      fetchPaymentMethods();
      
    } catch (error) {
      console.error('Ödeme yöntemi kaydedilirken hata:', error);
      Alert.alert('Hata', 'Ödeme yöntemi kaydedilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Ödeme yöntemi sil
  const handleDeletePaymentMethod = (item) => {
    Alert.alert(
      'Silme Onayı',
      `"${item.name}" ödeme yöntemini silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // İlişkili verileri kontrol et
              const { count, error: countError } = await supabase
                .from('sales')
                .select('id', { count: 'exact', head: true })
                .eq('payment_method_id', item.id);
                
              if (countError) throw countError;
              
              if (count > 0) {
                Alert.alert(
                  'Ödeme Yöntemi Silinemez',
                  'Bu ödeme yöntemi ile yapılmış satışlar olduğu için silinemez. İsterseniz durumunu pasif yapabilirsiniz.'
                );
                return;
              }
              
              // Ödeme yöntemini sil
              const { error } = await supabase
                .from('payment_methods')
                .delete()
                .eq('id', item.id);
                
              if (error) throw error;
              
              fetchPaymentMethods();
              Alert.alert('Başarılı', 'Ödeme yöntemi başarıyla silindi.');
              
            } catch (error) {
              console.error('Ödeme yöntemi silinirken hata:', error);
              Alert.alert('Hata', 'Ödeme yöntemi silinirken bir sorun oluştu.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Ödeme yöntemi durumunu değiştir (aktif/pasif)
  const togglePaymentMethodStatus = async (item) => {
    try {
      setLoading(true);
      
      const newStatus = !item.is_active;
      
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_active: newStatus })
        .eq('id', item.id);
        
      if (error) throw error;
      
      // Listedeki durumu güncelle
      setPaymentMethods(
        paymentMethods.map(method => 
          method.id === item.id 
            ? {...method, is_active: newStatus} 
            : method
        )
      );
      
      Alert.alert(
        'Başarılı', 
        `Ödeme yöntemi durumu ${newStatus ? 'aktif' : 'pasif'} olarak güncellendi.`
      );
      
    } catch (error) {
      console.error('Ödeme yöntemi durumu güncellenirken hata:', error);
      Alert.alert('Hata', 'Ödeme yöntemi durumu güncellenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Ödeme yöntemi satırı render fonksiyonu
  const renderPaymentMethodItem = ({ item }) => (
    <View style={styles.tableRow}>
      <View style={styles.tableCell}>
        <Text style={styles.cellText}>{item.name}</Text>
      </View>
      <View style={styles.tableCell}>
        <View style={[
          styles.statusBadge, 
          { backgroundColor: item.is_active ? '#4caf50' : '#f44336' }
        ]}>
          <Text style={styles.statusText}>
            {item.is_active ? 'Aktif' : 'Pasif'}
          </Text>
        </View>
      </View>
      <View style={[styles.tableCell, { flex: 0.8, justifyContent: 'center' }]}>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => startEdit(item)}
          >
            <MaterialIcons name="edit" size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, item.is_active ? styles.deactivateButton : styles.activateButton]}
            onPress={() => togglePaymentMethodStatus(item)}
          >
            <MaterialIcons name={item.is_active ? "block" : "check-circle"} size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeletePaymentMethod(item)}
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
        <Text style={styles.tableHeaderText}>Ödeme Yöntemi</Text>
      </View>
      <View style={styles.tableHeaderCell}>
        <Text style={styles.tableHeaderText}>Durum</Text>
      </View>
      <View style={[styles.tableHeaderCell, { flex: 0.8 }]}>
        <Text style={styles.tableHeaderText}>İşlemler</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ödeme Yöntemleri</Text>
        <View style={styles.headerActions}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Ödeme Yöntemi Ara..."
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
            <Text style={styles.addButtonText}>Yeni Ödeme Yöntemi</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Ödeme yöntemleri yükleniyor...</Text>
        </View>
      ) : (
        <View style={styles.tableContainer}>
          {renderTableHeader()}
          
          {paymentMethods.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="information-circle-outline" size={50} color="#888" />
              <Text style={styles.noDataText}>
                {filterApplied 
                  ? "Aranan kriterlere uygun ödeme yöntemi bulunamadı." 
                  : "Henüz ödeme yöntemi eklenmemiş."}
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
              data={paymentMethods}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderPaymentMethodItem}
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
      )}

      {/* Ödeme Yöntemi Ekleme/Düzenleme Modal */}
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
              {formMode === 'add' ? 'Yeni Ödeme Yöntemi Ekle' : 'Ödeme Yöntemi Düzenle'}
            </Text>
            
            <ScrollView style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Ödeme Yöntemi Adı</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({...formData, name: text})}
                  placeholder="Ödeme yöntemi adını girin"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Açıklama</Text>
                <TextInput
                  style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({...formData, description: text})}
                  placeholder="Açıklama girin"
                  multiline
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Durum</Text>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>{formData.is_active ? 'Aktif' : 'Pasif'}</Text>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(value) => setFormData({...formData, is_active: value})}
                    trackColor={{ false: "#767577", true: "#1e3a8a" }}
                    thumbColor={formData.is_active ? "#fff" : "#f4f3f4"}
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
                onPress={handleSavePaymentMethod}
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
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  activateButton: {
    backgroundColor: '#4caf50',
  },
  deactivateButton: {
    backgroundColor: '#f44336',
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
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
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

export default PaymentsScreen; 