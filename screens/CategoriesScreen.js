import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const CategoriesScreen = ({ branchId }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  
  // Error messages
  const [errors, setErrors] = useState({});

  // Kategorileri getir
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      if (data) {
        setCategories(data);
        console.log(`${data.length} kategori yüklendi.`);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Kategoriler alınırken hata:', error);
      Alert.alert('Hata', 'Kategoriler yüklenirken bir sorun oluştu.');
      setLoading(false);
    }
  };

  // Filtreleme fonksiyonu
  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Form alanlarını temizle
  const resetForm = () => {
    setName('');
    setDescription('');
    setIsActive(true);
    setUploadedImage(null);
    setImageUrl(null);
    setErrors({});
  };

  // Düzenleme modunu başlat
  const startEdit = (category) => {
    setIsEditing(true);
    setCurrentCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setIsActive(category.is_active !== false); // null veya undefined ise true kabul et
    setImageUrl(category.image_url);
    setModalVisible(true);
  };

  // Kategori formunu göster
  const showAddCategoryForm = () => {
    resetForm();
    setIsEditing(false);
    setCurrentCategory(null);
    setModalVisible(true);
  };

  // Form validasyonu
  const validateForm = () => {
    const newErrors = {};
    
    if (!name.trim()) newErrors.name = 'Kategori adı gereklidir';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Resim seçme
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Resim seçmek için galeri izni gereklidir.');
      return;
    }
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    
    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setUploadedImage(asset);
    }
  };

  // Resmi yükle ve URL al
  const uploadImageAndGetUrl = async () => {
    if (!uploadedImage || !uploadedImage.base64) return null;
    
    try {
      const fileName = `category_${Date.now()}.jpg`;
      const filePath = `categories/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('category-images')
        .upload(filePath, decode(uploadedImage.base64), {
          contentType: 'image/jpeg',
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      // Public URL oluştur
      const { data } = supabase.storage
        .from('category-images')
        .getPublicUrl(filePath);
        
      return data.publicUrl;
    } catch (error) {
      console.error('Resim yüklenirken hata:', error);
      Alert.alert('Resim Yükleme Hatası', 'Resim yüklenirken bir sorun oluştu.');
      return null;
    }
  };

  // Kategori ekle veya güncelle
  const handleSaveCategory = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Eğer yeni resim yüklendiyse, storage'a yükle
      let finalImageUrl = imageUrl;
      if (uploadedImage) {
        finalImageUrl = await uploadImageAndGetUrl();
      }
      
      const categoryData = {
        name,
        description,
        is_active: isActive,
        image_url: finalImageUrl,
        updated_at: new Date()
      };
      
      let result;
      
      if (isEditing && currentCategory) {
        // Kategori güncelleme
        result = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', currentCategory.id);
      } else {
        // Yeni kategori ekleme
        categoryData.created_at = new Date();
        result = await supabase
          .from('categories')
          .insert(categoryData);
      }
      
      if (result.error) throw result.error;
      
      // Başarılı ise formu kapat ve kategorileri yenile
      setModalVisible(false);
      resetForm();
      fetchCategories();
      
      Alert.alert(
        'Başarılı', 
        isEditing ? 'Kategori başarıyla güncellendi.' : 'Yeni kategori başarıyla eklendi.'
      );
    } catch (error) {
      console.error('Kategori kaydedilirken hata:', error);
      Alert.alert('Hata', 'Kategori kaydedilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Kategori silme
  const handleDeleteCategory = (category) => {
    Alert.alert(
      'Kategoriyi Sil',
      `"${category.name}" kategorisini silmek istediğinize emin misiniz?`,
      [
        {
          text: 'İptal',
          style: 'cancel'
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Önce bu kategorideki ürünleri kontrol et
              const { data: products, error: checkError } = await supabase
                .from('products')
                .select('id')
                .eq('category_id', category.id);
                
              if (checkError) throw checkError;
              
              if (products && products.length > 0) {
                Alert.alert(
                  'Uyarı',
                  `Bu kategoriye ait ${products.length} ürün bulunmaktadır. Kategoriyi silmeden önce ürünleri başka bir kategoriye taşıyın.`
                );
                setLoading(false);
                return;
              }
              
              const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', category.id);
                
              if (error) throw error;
              
              // Kategoriyi listeden kaldır
              setCategories(categories.filter(c => c.id !== category.id));
              Alert.alert('Başarılı', 'Kategori başarıyla silindi.');
            } catch (error) {
              console.error('Kategori silinirken hata:', error);
              Alert.alert('Hata', 'Kategori silinirken bir sorun oluştu.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Kategori durumunu değiştir (aktif/pasif)
  const toggleCategoryStatus = async (category) => {
    setLoading(true);
    try {
      const newStatus = !category.is_active;
      
      const { error } = await supabase
        .from('categories')
        .update({ is_active: newStatus, updated_at: new Date() })
        .eq('id', category.id);
        
      if (error) throw error;
      
      // Kategori listesini güncelle
      setCategories(
        categories.map(c => 
          c.id === category.id ? { ...c, is_active: newStatus } : c
        )
      );
      
      Alert.alert(
        'Durum Değiştirildi', 
        `Kategori durumu ${newStatus ? 'aktif' : 'pasif'} olarak ayarlandı.`
      );
    } catch (error) {
      console.error('Kategori durumu değiştirilirken hata:', error);
      Alert.alert('Hata', 'Kategori durumu değiştirilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Render kategori elementi
  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.categoryItemContainer} 
      onPress={() => startEdit(item)}
      onLongPress={() => handleDeleteCategory(item)}
    >
      <Image 
        // Eğer item.image_url varsa ve '/noimage.jpg' değilse URI'yi kullan, yoksa lokal resmi kullan
        source={item.image_url && item.image_url !== '/noimage.jpg' && item.image_url.trim() !== '' ? { uri: item.image_url } : require('../assets/noimage.jpg')}
        style={styles.categoryImage} 
        resizeMode="cover"
      />
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.categoryDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <View style={styles.categoryActions}>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={item.is_active !== false ? "#1e3a8a" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={() => toggleCategoryStatus(item)}
          value={item.is_active !== false} // null ve undefined durumlarını true olarak ele al
          style={styles.statusSwitch}
        />
        <Ionicons name="chevron-forward" size={22} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kategori Yönetimi</Text>
        
        <TouchableOpacity style={styles.addButton} onPress={showAddCategoryForm}>
          <Text style={styles.addButtonText}>Yeni Kategori Ekle</Text>
          <Ionicons name="add-circle" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Kategori ara..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading && categories.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Kategoriler yükleniyor...</Text>
        </View>
      ) : filteredCategories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Kategori bulunamadı</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery 
              ? 'Arama kriterlerinize uygun kategori bulunamadı.' 
              : 'Henüz kategori eklenmemiş. "Yeni Kategori Ekle" butonuna tıklayarak kategori ekleyin.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          renderItem={renderCategoryItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.categoriesList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Kategori Ekleme/Düzenleme Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Kategoriyi Düzenle' : 'Yeni Kategori Ekle'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Resim Seçimi */}
              <View style={styles.imagePickerContainer}>
                <TouchableOpacity 
                  style={styles.imagePicker}
                  onPress={pickImage}
                >
                  {uploadedImage ? (
                    <Image 
                      source={{ uri: uploadedImage.uri }} 
                      style={styles.previewImage} 
                    />
                  ) : imageUrl ? (
                    <Image 
                      source={{ uri: imageUrl }} 
                      style={styles.previewImage} 
                    />
                  ) : (
                    <>
                      <Ionicons name="image" size={40} color="#666" />
                      <Text style={styles.imagePickerText}>Resim Seç</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            
              {/* Kategori Adı */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Kategori Adı *</Text>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder="Kategori adını girin"
                  value={name}
                  onChangeText={setName}
                />
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>
              
              {/* Açıklama */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Açıklama</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Kategori açıklaması girin"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>
              
              {/* Durum */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.label}>Aktif</Text>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: '#ccc', true: '#81b0ff' }}
                    thumbColor={isActive ? '#1e3a8a' : '#f4f3f4'}
                  />
                </View>
                <Text style={styles.helperText}>
                  {isActive ? 'Kategori aktif olacak' : 'Kategori pasif olacak'}
                </Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={handleSaveCategory}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {isEditing ? 'Güncelle' : 'Kaydet'}
                  </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  addButtonText: {
    color: 'white',
    marginRight: 5,
  },
  filterContainer: {
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 5,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 10,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#999',
    marginTop: 5,
  },
  categoriesList: {
    padding: 15,
  },
  categoryItemContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryImage: {
    width: 60,
    height: 60,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
  },
  categoryInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  categoryDescription: {
    color: '#777',
    fontSize: 13,
  },
  categoryActions: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  statusSwitch: {
    transform: [{ scale: 0.8 }],
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginHorizontal: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 15,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  imagePickerContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  imagePicker: {
    width: 120,
    height: 120,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 10,
  },
  imagePickerText: {
    marginTop: 5,
    color: '#666',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 5,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  cancelButtonText: {
    color: '#666',
  }
});

export default CategoriesScreen; 