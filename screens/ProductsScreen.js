import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  Alert,
  Modal,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// Ekran boyutlarını alıyoruz
const { width, height } = Dimensions.get('window');

const ProductsScreen = ({ branchId }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  
  // Sayfalama state'leri
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // FlatList referansı
  const flatListRef = React.useRef();
  
  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [allMasterIngredients, setAllMasterIngredients] = useState([]);
  const [currentProductIngredients, setCurrentProductIngredients] = useState([]);
  
  // Error messages
  const [errors, setErrors] = useState({});

  // Ürünleri ve kategorileri getir
  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchMasterIngredients();
  }, []);

  // Şube ID'si değiştiğinde ürünleri yeniden getir
  useEffect(() => {
    if (branchId) {
      fetchProducts();
    }
  }, [branchId]);

  // Şube ID'si veya Kategori değiştiğinde ürünleri yeniden ve sıfırdan getir
  useEffect(() => {
    setCurrentPage(1);
    fetchProducts(1, true);
  }, [branchId, selectedCategory]);

  // Kategorileri getir
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Kategoriler alınırken hata:', error);
      Alert.alert('Hata', 'Kategoriler yüklenirken bir sorun oluştu.');
    }
  };

  // Ana Malzemeleri Getir
  const fetchMasterIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('id, name, unit')
        .order('name');
      if (error) throw error;
      if (data) {
        setAllMasterIngredients(data);
      }
    } catch (error) {
      console.error('Ana malzemeler alınırken hata:', error);
      Alert.alert('Hata', 'Ana malzemeler yüklenirken bir sorun oluştu.');
    }
  };

  // Ürünleri getir
  const fetchProducts = async (pageToFetch, isNewQuery = false) => {
    if (isNewQuery) {
      setLoading(true);
    } else {
      if (loadingMore || (products.length >= totalCount && totalCount > 0)) {
        return;
      }
      setLoadingMore(true);
    }

    try {
      const from = (pageToFetch - 1) * pageSize;
      const to = from + pageSize - 1;

      if (isNewQuery) {
        let countQuery = supabase
          .from('products')
          .select('id', { count: 'exact' });
        if (selectedCategory) {
          countQuery = countQuery.eq('category_id', selectedCategory);
        }
        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        setTotalCount(count || 0);
      }
      
      let query = supabase
        .from('products')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .order('name')
        .range(from, to);
      
      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        if (isNewQuery) {
          setProducts(data);
          console.log(`${data.length} ürün yüklendi (yeni sorgu). Sayfa: ${pageToFetch}, Toplam: ${totalCount}`);
        } else {
          setProducts(prevProducts => [...prevProducts, ...data]);
          console.log(`${data.length} ürün daha yüklendi. Sayfa: ${pageToFetch}, Mevcut: ${products.length + data.length}, Toplam: ${totalCount}`);
        }
      }
      
    } catch (error) {
      console.error('Ürünler alınırken hata:', error);
      Alert.alert('Hata', 'Ürünler yüklenirken bir sorun oluştu.');
    } finally {
      if (isNewQuery) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  // Belirli Bir Ürünün Malzemelerini Getir
  const fetchProductSpecificIngredients = async (productId) => {
    if (!productId) {
      setCurrentProductIngredients([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('product_ingredients')
        .select(`
          quantity_required,
          ingredients (
            id,
            name,
            unit
          )
        `)
        .eq('product_id', productId);

      if (error) throw error;

      if (data) {
        const formattedIngredients = data.map(pi => ({
          ingredient_id: pi.ingredients.id,
          name: pi.ingredients.name,
          unit: pi.ingredients.unit,
          quantity_required: pi.quantity_required
        }));
        setCurrentProductIngredients(formattedIngredients);
      } else {
        setCurrentProductIngredients([]);
      }
    } catch (error) {
      console.error('Ürünün malzemeleri alınırken hata:', error);
      setCurrentProductIngredients([]); // Hata durumunda boşalt
      Alert.alert('Hata', 'Ürünün malzemeleri yüklenirken bir sorun oluştu.');
    }
  };

  // Filtreleme fonksiyonu
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? product.category_id === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  // Form alanlarını temizle
  const resetForm = () => {
    setName('');
    setPrice('');
    setDescription('');
    setCategoryId(null);
    setIsActive(true);
    setUploadedImage(null);
    setImageUrl(null);
    setCurrentProductIngredients([]);
    setErrors({});
  };

  // Düzenleme modunu başlat
  const startEdit = async (product) => {
    setIsEditing(true);
    setCurrentProduct(product);
    setName(product.name);
    setPrice(product.price ? product.price.toString() : '');
    setDescription(product.description || '');
    setCategoryId(product.category_id);
    setIsActive(product.is_active !== false);
    setImageUrl(product.image_url);
    await fetchProductSpecificIngredients(product.id);
    setModalVisible(true);
  };

  // Ürün formunu göster
  const showAddProductForm = () => {
    resetForm();
    setIsEditing(false);
    setCurrentProduct(null);
    setModalVisible(true);
  };

  // Form validasyonu
  const validateForm = () => {
    const newErrors = {};
    
    if (!name.trim()) newErrors.name = 'Ürün adı gereklidir';
    if (!price.trim()) newErrors.price = 'Fiyat gereklidir';
    else if (isNaN(parseFloat(price))) newErrors.price = 'Geçerli bir fiyat giriniz';
    if (!categoryId) newErrors.category = 'Kategori seçilmelidir';
    
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
    });
    
    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setUploadedImage(asset);
    }
  };

  // Resmi yükle ve URL al
  const uploadImageAndGetUrl = async () => {
    if (!uploadedImage || !uploadedImage.uri) return null;

    try {
      const fileName = `product_${Date.now()}.jpg`;
      const filePath = `products/${fileName}`;

      // Dosyayı blob olarak al
      const response = await fetch(uploadedImage.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Public URL oluştur
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Resim yüklenirken hata:', error);
      Alert.alert('Resim Yükleme Hatası', 'Resim yüklenirken bir sorun oluştu.');
      return null;
    }
  };

  // Ürün ekle veya güncelle
  const handleSaveProduct = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      let finalImageUrl = imageUrl;
      if (uploadedImage) {
        finalImageUrl = await uploadImageAndGetUrl();
      }
      
      const productData = {
        name,
        price: parseFloat(price),
        description,
        category_id: categoryId,
        is_active: isActive,
        image_url: finalImageUrl,
        updated_at: new Date()
      };
      
      let savedProduct;
      
      if (isEditing && currentProduct) {
        const { data, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', currentProduct.id)
          .select()
          .single();
        if (error) throw error;
        savedProduct = data;
      } else {
        productData.created_at = new Date();
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();
        if (error) throw error;
        savedProduct = data;
      }

      if (!savedProduct || !savedProduct.id) {
        throw new Error("Ürün ID'si alınamadı.");
      }

      // Malzemeleri güncelle/ekle (product_ingredients tablosu)
      // Önce mevcut ürün ID'sine ait tüm malzemeleri sil
      const { error: deleteError } = await supabase
        .from('product_ingredients')
        .delete()
        .eq('product_id', savedProduct.id);

      if (deleteError) {
        console.error('Eski malzemeler silinirken hata:', deleteError);
        // Silme hatası olsa bile devam etmeyi deneyebiliriz veya kullanıcıya bilgi verebiliriz.
        // Şimdilik devam ediyoruz.
      }
      
      // Sonra yeni malzemeleri ekle
      if (currentProductIngredients.length > 0) {
        const ingredientsToInsert = currentProductIngredients.map(ing => ({
          product_id: savedProduct.id,
          ingredient_id: ing.ingredient_id,
          quantity_required: parseFloat(ing.quantity_required) || 0
        }));

        const { error: insertError } = await supabase
          .from('product_ingredients')
          .insert(ingredientsToInsert);

        if (insertError) throw insertError;
      }
      
      setModalVisible(false);
      resetForm();
      fetchProducts(currentPage, true);
      
      Alert.alert(
        'Başarılı', 
        isEditing ? 'Ürün ve malzemeleri başarıyla güncellendi.' : 'Yeni ürün ve malzemeleri başarıyla eklendi.'
      );
    } catch (error) {
      console.error('Ürün kaydedilirken hata:', error);
      Alert.alert('Hata', 'Ürün ve malzemeler kaydedilirken bir sorun oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Ürün silme
  const handleDeleteProduct = (product) => {
    Alert.alert(
      'Ürünü Sil',
      `"${product.name}" ürününü silmek istediğinize emin misiniz?`,
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
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', product.id);
                
              if (error) throw error;
              
              // Ürünü listeden kaldır
              setProducts(products.filter(p => p.id !== product.id));
              Alert.alert('Başarılı', 'Ürün başarıyla silindi.');
            } catch (error) {
              console.error('Ürün silinirken hata:', error);
              Alert.alert('Hata', 'Ürün silinirken bir sorun oluştu.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Ürün durumunu değiştir (aktif/pasif)
  const toggleProductStatus = async (product) => {
    setLoading(true);
    try {
      const newStatus = !product.is_active;
      
      const { error } = await supabase
        .from('products')
        .update({ is_active: newStatus, updated_at: new Date() })
        .eq('id', product.id);
        
      if (error) throw error;
      
      // Ürün listesini güncelle
      setProducts(
        products.map(p => 
          p.id === product.id ? { ...p, is_active: newStatus } : p
        )
      );
      
      Alert.alert(
        'Durum Değiştirildi', 
        `Ürün durumu ${newStatus ? 'aktif' : 'pasif'} olarak ayarlandı.`
      );
    } catch (error) {
      console.error('Ürün durumu değiştirilirken hata:', error);
      Alert.alert('Hata', 'Ürün durumu değiştirilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Kategori adını ID'ye göre getir
  const getCategoryNameById = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Kategorisiz';
  };

  // Malzeme modalını açmak için fonksiyon
  const openIngredientsModal = async (product) => {
    if (!product || !product.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_ingredients')
        .select(`
          quantity_required,
          ingredients (
            name,
            unit
          )
        `)
        .eq('product_id', product.id);

      if (error) throw error;

      let message = `${product.name} - Malzemeler:\n`;
      if (data && data.length > 0) {
        data.forEach(pi => {
          message += `- ${pi.ingredients.name}: ${pi.quantity_required} ${pi.ingredients.unit || ''}`;
        });
      } else {
        message += "Bu ürün için malzeme bilgisi girilmemiş.";
      }
      Alert.alert("Malzeme Bilgisi", message, [{ text: "Tamam" }]);

    } catch (error) {
      console.error(`${product.name} malzemeleri alınırken hata:`, error);
      Alert.alert('Hata', 'Malzemeler yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Render ürün elementi
  const renderProductItem = ({ item }) => {
    return (
      <View style={styles.productItemContainer}>
        <TouchableOpacity onPress={() => openIngredientsModal(item)} style={styles.productTouchableContent}>
          <Image 
            source={(item.image_url && item.image_url !== '/noimage.jpg') ? { uri: item.image_url } : require('../assets/noimage.jpg')} 
            style={styles.productImage} 
            resizeMode="cover"
          />
          <View style={styles.productInfoContainer}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productCategory}>{getCategoryNameById(item.category_id)}</Text>
            <Text style={styles.productPrice}>{item.price ? `${item.price.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}` : 'Fiyat Yok'}</Text>
            <Text style={[styles.productStatus, item.is_active ? styles.activeStatus : styles.inactiveStatus]}>
              {item.is_active ? 'Aktif' : 'Pasif'}
            </Text>
          </View>
        </TouchableOpacity>
        {/* Ürün düzenleme/silme butonları veya toggle eklenebilir */}
         <View style={styles.productActionsContainer}>
          <TouchableOpacity onPress={() => openIngredientsModal(item)} style={styles.actionButton}>
            <MaterialIcons name="list-alt" size={22} color="#555" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => startEdit(item)} style={styles.actionButton}>
            <Ionicons name="pencil" size={20} color="#1e3a8a" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggleProductStatus(item)} style={styles.actionButton}>
            <Ionicons name={item.is_active ? "eye-off-outline" : "eye-outline"} size={22} color={item.is_active ? "#ff8c00" : "#4CAF50"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteProduct(item)} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={22} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const loadMoreProducts = () => {
    if (loading || loadingMore || (totalCount > 0 && products.length >= totalCount)) {
      console.log("Daha fazla yükleme engellendi:", {loading, loadingMore, productsLength: products.length, totalCount});
      return;
    }
    
    const nextPage = currentPage + 1;
    console.log(`Daha fazla ürün yükleniyor: sayfa ${nextPage}`);
    setCurrentPage(nextPage);
    fetchProducts(nextPage, false);
  };

  const renderListFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.footerLoadingText}>Daha fazla yükleniyor...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ürün Yönetimi</Text>
        
        <TouchableOpacity style={styles.addButton} onPress={showAddProductForm}>
          <Text style={styles.addButtonText}>Yeni Ürün Ekle</Text>
          <Ionicons name="add-circle" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Toplam Ürün Adedi -- YENİ BÖLÜM */}
      {!loading && (
        <View style={styles.productCountContainer}>
          <Text style={styles.productCountText}>Toplam Ürün: {totalCount}</Text>
        </View>
      )}

      <View style={styles.filterContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün ara..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <View style={styles.categoryFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === null && styles.selectedCategory
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === null && styles.selectedCategoryText
              ]}>Tümü</Text>
            </TouchableOpacity>
            
            {categories.map(category => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.selectedCategory
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text style={[
                  styles.categoryChipText,
                  selectedCategory === category.id && styles.selectedCategoryText
                ]}>{category.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {loading && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="basket" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Ürün bulunamadı</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery 
              ? 'Arama kriterlerinize uygun ürün bulunamadı.' 
              : 'Henüz ürün eklenmemiş. "Yeni Ürün Ekle" butonuna tıklayarak ürün ekleyin.'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.productsList}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreProducts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderListFooter}
        />
      )}

      {/* Ürün Ekleme/Düzenleme Modal */}
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
                {isEditing ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
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
            
              {/* Ürün Adı */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Ürün Adı *</Text>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder="Ürün adını girin"
                  value={name}
                  onChangeText={setName}
                />
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>
              
              {/* Kategori Seçimi */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Kategori *</Text>
                <View style={[styles.pickerContainer, errors.category && styles.inputError]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {categories.map(category => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryChip,
                          categoryId === category.id && styles.selectedCategory
                        ]}
                        onPress={() => setCategoryId(category.id)}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          categoryId === category.id && styles.selectedCategoryText
                        ]}>{category.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
              </View>
              
              {/* Fiyat */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Fiyat (₺) *</Text>
                <TextInput
                  style={[styles.input, errors.price && styles.inputError]}
                  placeholder="0.00"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
                {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
              </View>
              
              {/* Açıklama */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Açıklama</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ürün açıklaması girin"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Malzemeler -- YENİ ALAN */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Ürün Malzemeleri</Text>
                {currentProductIngredients.map((ing, index) => (
                  <View key={ing.ingredient_id || `new-${index}`} style={styles.ingredientRow}>
                    <Text style={styles.ingredientNameText}>{ing.name} ({ing.unit || 'Birim Yok'})</Text>
                    <TextInput
                      style={styles.ingredientQuantityInput}
                      placeholder="Miktar"
                      value={ing.quantity_required ? ing.quantity_required.toString() : ''}
                      onChangeText={(text) => {
                        const newIngredients = [...currentProductIngredients];
                        newIngredients[index].quantity_required = text;
                        setCurrentProductIngredients(newIngredients);
                      }}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => {
                      const newIngredients = currentProductIngredients.filter((_, i) => i !== index);
                      setCurrentProductIngredients(newIngredients);
                    }}>
                      <Ionicons name="trash-outline" size={22} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity 
                  style={styles.addIngredientButton}
                  onPress={() => {
                    if (allMasterIngredients.length > 0) {
                      const availableToAdd = allMasterIngredients.filter(
                        masterIng => !currentProductIngredients.some(currentIng => currentIng.ingredient_id === masterIng.id)
                      );

                      if (availableToAdd.length === 0) {
                        Alert.alert("Malzeme Yok", "Eklenebilecek yeni malzeme bulunmuyor veya tüm malzemeler zaten ekli.");
                        return;
                      }
                      
                      Alert.alert(
                        "Malzeme Seç",
                        "Eklemek istediğiniz malzemeyi seçin:",
                        availableToAdd.map(masterIng => ({
                          text: `${masterIng.name} (${masterIng.unit || ''})`,
                          onPress: () => {
                            setCurrentProductIngredients([
                              ...currentProductIngredients,
                              { 
                                ingredient_id: masterIng.id, 
                                name: masterIng.name, 
                                unit: masterIng.unit, 
                                quantity_required: '1'
                              }
                            ]);
                          }
                        })).concat([{text: "İptal", style: "cancel"}])
                      );
                    } else {
                      Alert.alert("Ana Malzeme Listesi Boş", "Lütfen önce ana malzeme listesine veri ekleyin.");
                    }
                  }}
                >
                  <Ionicons name="add-circle-outline" size={24} color="#1e3a8a" />
                  <Text style={styles.addIngredientButtonText}>Malzeme Ekle</Text>
                </TouchableOpacity>
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
                  {isActive ? 'Ürün satışa açık olacak' : 'Ürün satışa kapalı olacak'}
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
                onPress={handleSaveProduct}
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
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  categoryFilters: {
    marginTop: 10,
  },
  categoryChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedCategory: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  categoryChipText: {
    color: '#333',
  },
  selectedCategoryText: {
    color: 'white',
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
  productsList: {
    padding: 10,
    paddingBottom: 80, // Sabit sayfalama kontrollerinin altında içerik kalmaması için
  },
  productItemContainer: {
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
  productTouchableContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  productInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  productCategory: {
    color: '#666',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
  },
  productStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  activeStatus: {
    color: '#4CAF50',
  },
  inactiveStatus: {
    color: '#F44336',
  },
  productActionsContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  actionButton: {
    padding: 8,
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
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
  },
  footerLoadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  productCountContainer: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  productCountText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  ingredientNameText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  ingredientQuantityInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    width: 80,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  addIngredientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    justifyContent: 'center',
  },
  addIngredientButtonText: {
    marginLeft: 8,
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
});

export default ProductsScreen; 