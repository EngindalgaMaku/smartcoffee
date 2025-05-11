import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ScrollView,
  Dimensions,
  Modal,
  SafeAreaView,
  Animated,
  ActivityIndicator,
  Alert
} from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width / 2 - 20;

// Ürün resmi için yerel placeholder resim kullan
const PLACEHOLDER_IMAGE = require('../assets/noimage.jpg');

const POSScreen = ({ branchId }) => {
  const [categories, setCategories] = useState([
    { id: 0, name: 'Tümü', active: true },
    { id: 1, name: 'Atıştırmalıklar - Tatlılar', active: false },
    { id: 2, name: 'Bubble Tea\'s', active: false },
    { id: 3, name: 'Extra', active: false },
    { id: 4, name: 'Fresh Drink\'s', active: false },
    { id: 5, name: 'Hot Coffee and More', active: false },
    { id: 6, name: 'Ice Coffee and More', active: false },
    { id: 7, name: 'Meşrubat', active: false },
    { id: 8, name: 'Tea and More', active: false },
  ]);
  
  const [products, setProducts] = useState([
    { id: 1, name: 'AMERICANO (BÜYÜK)', price: 55.00, image: PLACEHOLDER_IMAGE, category_id: 5 },
    { id: 2, name: 'AMERICANO (KÜÇÜK)', price: 45.00, image: PLACEHOLDER_IMAGE, category_id: 5 },
    { id: 3, name: 'BERRY HIBISCUS(BÜYÜK)', price: 70.00, image: PLACEHOLDER_IMAGE, category_id: 4 },
    { id: 4, name: 'BERRY HIBISCUS(KÜÇÜK)', price: 60.00, image: PLACEHOLDER_IMAGE, category_id: 4 },
    { id: 5, name: 'BİTKİ ÇAYI', price: 50.00, image: PLACEHOLDER_IMAGE, category_id: 8 },
    { id: 6, name: 'BUBBLE TEA(BÜYÜK)', price: 80.00, image: PLACEHOLDER_IMAGE, category_id: 2 },
    { id: 7, name: 'BUBBLE TEA(KÜÇÜK)', price: 70.00, image: PLACEHOLDER_IMAGE, category_id: 2 },
    { id: 8, name: 'BUZLU BARDAK', price: 15.00, image: PLACEHOLDER_IMAGE, category_id: 3 },
    { id: 9, name: 'ÇAY', price: 15.00, image: PLACEHOLDER_IMAGE, category_id: 8 },
    { id: 10, name: 'COLD BREW ( BÜYÜK )', price: 65.00, image: PLACEHOLDER_IMAGE, category_id: 6 },
    { id: 11, name: 'COLD BREW( KÜÇÜK )', price: 55.00, image: PLACEHOLDER_IMAGE, category_id: 6 },
    { id: 12, name: 'COOLIME (BÜYÜK)', price: 70.00, image: PLACEHOLDER_IMAGE, category_id: 4 },
    { id: 13, name: 'COOLIME (KÜÇÜK)', price: 60.00, image: PLACEHOLDER_IMAGE, category_id: 4 },
    { id: 14, name: 'Cornly', price: 30.00, image: PLACEHOLDER_IMAGE, category_id: 1 },
    { id: 15, name: 'DİBEK KAHVE(BÜYÜK)', price: 50.00, image: PLACEHOLDER_IMAGE, category_id: 5 },
  ]);
  
  const [cart, setCart] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [cartVisible, setCartVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Kredi Kartı');
  
  const categoryScrollRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(300)).current;
  
  useEffect(() => {
    // Kategorileri ve ürünleri yükle
    fetchCategories();
    fetchProducts();
  }, [branchId]); // Sadece branchId değiştiğinde veriyi yeniden yükle
  
  // Arama veya kategori değiştiğinde ürünleri filtrele
  useEffect(() => {
    filterProducts();
  }, [searchText, selectedCategory, products]);
  
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Tüm kategoriler için bir "Tümü" seçeneği ekleyelim
        const allCategories = [
          { id: 0, name: 'Tümü', active: true },
          ...data.map(cat => ({ 
            ...cat, 
            active: false 
          }))
        ];
        setCategories(allCategories);
      }
    } catch (error) {
      console.error('Kategoriler yüklenirken hata:', error);
    }
  }
  
  const fetchProducts = async () => {
    setLoading(true);
    try {
      console.log('Ürünler getiriliyor...');
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(id, name)
        `)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('Supabase sorgu hatası:', error);
        throw error;
      }

      if (data && data.length > 0) {
        console.log('Bulunan ürün sayısı:', data.length);
        
        // Ürünleri doğrudan işleyip görüntülenmeye hazır hale getiriyoruz
        const formattedProducts = data.map(product => {
          // Ürünü doğrudan varsayılan resimle hazırla - ağ hataları için
          return {
            ...product,
            // URL'yi olduğu gibi al, Image bileşeninde kontrol edilecek
            image_url: product.image_url || ''
          };
        });

        console.log('Ürünler formatlandı:', formattedProducts.length);
        
        setProducts(formattedProducts);
        setFilteredProducts(formattedProducts);
      } else {
        console.log('Hiç ürün bulunamadı');
        setProducts([]);
        setFilteredProducts([]);
      }
    } catch (error) {
      console.error('Ürünler yüklenirken hata:', error.message);
      Alert.alert('Hata', 'Ürünler yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const filterProducts = () => {
    let filtered = [...products];
    
    // Kategori filtreleme
    if (selectedCategory !== 0) {
      filtered = filtered.filter(product => product.category_id === selectedCategory);
    }
    
    // Arama filtreleme
    if (searchText.trim() !== '') {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredProducts(filtered);
  };
  
  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setCategories(categories.map(cat => ({
      ...cat,
      active: cat.id === categoryId
    })));
  };
  
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      // Ürün varsa miktarını artır
      setCart(cart.map(item => 
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      // Ürün yoksa ekle
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    
    // Sepeti otomatik olarak göster
    if (!cartVisible) {
      toggleCart();
    }
  };
  
  const removeFromCart = (productId) => {
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem.quantity > 1) {
      // Miktarı 1'den fazlaysa azalt
      setCart(cart.map(item => 
        item.id === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ));
    } else {
      // Miktarı 1 ise sepetten çıkar
      setCart(cart.filter(item => item.id !== productId));
    }
  };
  
  const toggleCart = () => {
    if (cartVisible) {
      // Sepeti kapat
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setCartVisible(false));
    } else {
      // Sepeti aç
      setCartVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };
  
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };
  
  const completeOrder = () => {
    setLoading(true);
    
    // Gerçek veritabanına sipariş kaydetme
    const saveOrder = async () => {
      try {
        // 1. Kullanıcı bilgisini al ve yetkiyi kontrol et
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw new Error('Kullanıcı bilgisi alınamadı. Lütfen tekrar giriş yapın.');
        }
        
        // Profil bilgisini al (user_id ve role_id için)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, role_id')
          .eq('id', user.id)
          .single();
          
        if (profileError || !profile) {
          throw new Error('Kullanıcı profili bulunamadı.');
        }
        
        // Yetki kontrolü (1-Admin, 3-Kasiyer rollerine izin ver)
        if (!profile.role_id || ![1, 3].includes(profile.role_id)) {
          throw new Error('Bu işlem için yetkiniz bulunmamaktadır.');
        }
        
        // 2. Sipariş içeriğini hazırla
        if (cart.length === 0) {
          throw new Error('Sepetiniz boş. Lütfen ürün ekleyin.');
        }
        
        // Her ürün için gerekli malzemeleri bul
        console.log('Ürün malzemeleri ve stok kontrolü yapılıyor...');
        
        // Malzeme stok ihtiyacını topla
        const requiredStock = {};
        
        // Her ürünün malzemelerini topla
        for (const item of cart) {
          // Ürüne ait malzeme bilgilerini al
          const { data: ingredients, error: ingredientsError } = await supabase
            .from('product_ingredients')
            .select(`
              ingredient_id,
              quantity_required,
              ingredients(id, name)
            `)
            .eq('product_id', item.id);
            
          if (ingredientsError) {
            throw new Error(`Ürün malzemeleri alınamadı: ${ingredientsError.message}`);
          }
          
          if (ingredients && ingredients.length > 0) {
            // Her malzeme için stok ihtiyacını hesapla (miktar * ürün adedi)
            ingredients.forEach(ing => {
              const ingredientId = ing.ingredient_id;
              const deductAmount = ing.quantity_required * item.quantity;
              
              requiredStock[ingredientId] = (requiredStock[ingredientId] || 0) + deductAmount;
            });
          }
        }
        
        // 3. Stok kontrolü yap
        const ingredientIds = Object.keys(requiredStock);
        
        if (ingredientIds.length > 0) {
          // Şube için mevcut stok seviyelerini al
          const { data: branchStocks, error: stockError } = await supabase
            .from('branch_ingredient_stock')
            .select('ingredient_id, stock_level')
            .eq('branch_id', branchId)
            .in('ingredient_id', ingredientIds);
            
          if (stockError) {
            throw new Error(`Stok bilgisi alınamadı: ${stockError.message}`);
          }
          
          // Malzeme isimlerini al (hata mesajları için)
          const { data: ingredientsInfo, error: ingInfoError } = await supabase
            .from('ingredients')
            .select('id, name')
            .in('id', ingredientIds);
            
          if (ingInfoError) {
            console.warn('Malzeme isimleri alınamadı:', ingInfoError.message);
          }
          
          // Malzeme isimlerini eşleştir
          const ingredientNameMap = {};
          if (ingredientsInfo) {
            ingredientsInfo.forEach(ing => {
              ingredientNameMap[ing.id] = ing.name || ing.id;
            });
          }
          
          // Stok yeterli mi kontrol et
          for (const id of ingredientIds) {
            const branchStock = branchStocks?.find(s => s.ingredient_id === id);
            const currentStockLevel = branchStock?.stock_level || 0;
            const requiredAmount = requiredStock[id];
            const ingredientName = ingredientNameMap[id] || id;
            
            if (!branchStock || currentStockLevel < requiredAmount) {
              throw new Error(`Stok yetersiz (${ingredientName}). İhtiyaç: ${requiredAmount}, Mevcut: ${currentStockLevel}`);
            }
          }
          
          console.log('Stok kontrolü başarılı. Sipariş oluşturuluyor...');
        }
        
        // 4. Sipariş kaydını oluştur
        console.log('Sipariş oluşturuluyor...');
        
        // Ödeme yöntemi ID'sini bul
        const { data: paymentMethodData, error: paymentMethodError } = await supabase
          .from('payment_methods')
          .select('id')
          .eq('name', paymentMethod)
          .single();
          
        if (paymentMethodError) {
          console.warn('Ödeme yöntemi bulunamadı:', paymentMethodError);
          throw new Error('Ödeme yöntemi bulunamadı.');
        }
        
        const paymentMethodId = paymentMethodData?.id || 1;
        
        let cashierName = 'Sistem'; // Varsayılan Kasiyer Adı
        if (user.id) {
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('full_name') // 'full_name' veya kullanıcı adını içeren alan
              .eq('id', user.id)
              .single();

            if (profile && profile.full_name) {
              cashierName = profile.full_name;
            } else if (user.email) {
              // Profil adı yoksa e-postayı kullan (isteğe bağlı)
              cashierName = user.email.split('@')[0]; 
            }
          } catch (e) {
            console.error("Profil alınırken hata:", e);
          }
        }

        console.log("Saving sale with cashierName:", cashierName); // Added for debugging

        const saleData = {
          branch_id: branchId || 1, // Varsayılan şube ID'si
          user_id: user.id, // Corrected from profile_id, assumes sales.user_id links to auth.users.id
          payment_method_id: paymentMethodId,
          total_amount: getCartTotal(),
          sale_time: new Date().toISOString()
          // cashier_name field removed as it doesn't exist in the sales table
        };
        
        // Sipariş kaydını oluştur (sales tablosuna)
        const { data: saleDataResult, error: saleError } = await supabase
          .from('sales')
          .insert(saleData)
          .select()
          .single();
          
        if (saleError) {
          throw new Error(`Sipariş oluşturulamadı: ${saleError.message}`);
        }
        
        const saleId = saleDataResult.id;
        
        // 5. Sipariş detaylarını oluştur (sale_items tablosuna)
        const saleItems = cart.map(item => ({
          sale_id: saleId,
          product_id: item.id,
          quantity: item.quantity,
          price_at_sale: item.price
        }));
        
        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems);
          
        if (itemsError) {
          throw new Error(`Sipariş detayları oluşturulamadı: ${itemsError.message}`);
        }
        
        // 6. Stok güncellemesi yap
        if (ingredientIds.length > 0) {
          console.log('Stok güncelleniyor...');
          
          for (const id of ingredientIds) {
            // Mevcut stok seviyesini al
            const { data: currentStock, error: currentStockError } = await supabase
              .from('branch_ingredient_stock')
              .select('stock_level')
              .eq('branch_id', branchId)
              .eq('ingredient_id', id)
              .single();
              
            if (currentStockError) {
              console.error(`Stok güncellenirken hata: ${currentStockError.message}`);
              continue;
            }
            
            // Yeni stok seviyesini hesapla
            const newStockLevel = (currentStock?.stock_level || 0) - requiredStock[id];
            
            // Stok güncelle
            const { error: updateError } = await supabase
              .from('branch_ingredient_stock')
              .update({ stock_level: newStockLevel })
              .eq('branch_id', branchId)
              .eq('ingredient_id', id);
              
            if (updateError) {
              console.error(`Stok güncellenirken hata: ${updateError.message}`);
            }
          }
        }
        
        // 7. İşlem tamamlandı
        setLoading(false);
        setCart([]);
        Alert.alert('Başarılı', 'Siparişiniz başarıyla tamamlandı!');
        toggleCart();
        
      } catch (error) {
        console.error('Sipariş işlemi hatası:', error);
        setLoading(false);
        Alert.alert('Hata', error.message || 'Sipariş işlenirken bir hata oluştu.');
      }
    };
    
    saveOrder();
  };
  
  // Siparişi doğrudan tamamlamak için kullanılabilecek fonksiyon
  const directCompleteOrder = () => {
    // Sepet kapalıysa ve ürün varsa, sepeti göstermeden doğrudan siparişi tamamla
    if (cart.length > 0) {
      completeOrder();
    } else {
      Alert.alert('Boş Sepet', 'Siparişi tamamlamak için sepetinize ürün ekleyin.');
    }
  };
  
  // Resim URL'si ile ilgili yardımcı fonksiyon - Daha güvenilir hata yönetimi ekledik
  const getValidImageSource = (imageUrl) => {
    if (!imageUrl || imageUrl === '') {
      return PLACEHOLDER_IMAGE;
    }
    
    // Yerel resim deposundan resim kullanmak daha güvenilir olabilir
    try {
      // URL'deki çift slash hatasını düzeltme
      if (typeof imageUrl === 'string') {
        // HTTP(S) URL'lerindeki çift slashları temizle (protocol://domain/) sonrasındaki çift slashları temizle
        imageUrl = imageUrl.replace(/([^:]\/)\/+/g, "$1");
      }
      
      // Geçerli URL formatı kontrolü yap
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return { 
          uri: imageUrl,
          headers: { 'Cache-Control': 'max-age=86400' }, // Önbelleğe alma süresini artır
          cache: 'force-cache' // Resmi agresif bir şekilde önbelleğe al
        };
      }
    } catch (e) {
      console.error('Resim URL işleme hatası:', e);
    }
    
    // Sorun varsa veya geçersiz URL formatı ise placeholder kullan
    return PLACEHOLDER_IMAGE;
  };
  
  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        item.active && styles.activeCategoryItem
      ]}
      onPress={() => selectCategory(item.id)}
    >
      <Text 
        style={[
          styles.categoryText,
          item.active && styles.activeCategoryText
        ]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );
  
  const renderProductItem = ({ item }) => {
    // Ürün resmi için güvenli URL kontrolü ve kaynak oluştur
    const imageSource = getValidImageSource(item.image_url);
    
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => addToCart(item)}
      >
        <View style={styles.productImageContainer}>
          <Image
            source={imageSource}
            style={styles.productImage}
            resizeMode="cover"
            // Varsayılan resim zaten source içinde sağlanıyor
            onError={() => {
              console.log(`Resim yüklenemedi: ${item.id} - ${item.name}`);
              // Hata durumunda göstermek için herhangi bir işlem yapmaya gerek yok,
              // çünkü source zaten varsayılan resmi içeriyor
            }}
          />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>₺{item.price.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cartItemPrice}>₺{item.price.toFixed(2)}</Text>
      </View>
      
      <View style={styles.cartItemActions}>
        <TouchableOpacity 
          style={styles.cartItemButton}
          onPress={() => removeFromCart(item.id)}
        >
          <MaterialIcons name="remove" size={18} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.cartItemQuantity}>{item.quantity}</Text>
        
        <TouchableOpacity 
          style={styles.cartItemButton}
          onPress={() => addToCart(item)}
        >
          <MaterialIcons name="add" size={18} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Üst Çubuk */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>POS</Text>
        <View style={styles.cartIconContainer}>
          {cart.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cart.reduce((total, item) => total + item.quantity, 0)}
              </Text>
            </View>
          )}
          <TouchableOpacity onPress={toggleCart}>
            <MaterialIcons name="shopping-cart" size={28} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Arama Çubuğu */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color="#777" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün Ara..."
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setSearchText('')}
          >
            <MaterialIcons name="close" size={20} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Kategori Listesi */}
      <View style={styles.categoryContainer}>
        <FlatList
          ref={categoryScrollRef}
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={item => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        />
      </View>
      
      {/* Ürün Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
        </View>
      ) : filteredProducts.length > 0 ? (
        <FlatList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={item => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.productList}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Ürün bulunamadı</Text>
        </View>
      )}
      
      {/* Sipariş Özeti (Kaydırılabilir Panel) */}
      {cartVisible && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={toggleCart}
        />
      )}
      
      <Animated.View 
        style={[
          styles.cartContainer,
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>Sipariş Özeti</Text>
          <TouchableOpacity onPress={toggleCart}>
            <MaterialIcons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        
        {cart.length > 0 ? (
          <View style={styles.cartContent}>
            <ScrollView style={{maxHeight: '65%'}}>
              <FlatList
                data={cart}
                renderItem={renderCartItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.cartList}
                scrollEnabled={false}
              />
              
              <View style={styles.cartDivider} />
              
              <View style={styles.paymentSection}>
                <Text style={styles.paymentTitle}>Ödeme Yöntemi</Text>
                
                <View style={styles.paymentOptions}>
                  <TouchableOpacity 
                    style={[
                      styles.paymentOption,
                      paymentMethod === 'Kredi Kartı' && styles.activePaymentOption
                    ]}
                    onPress={() => setPaymentMethod('Kredi Kartı')}
                  >
                    <MaterialIcons 
                      name="credit-card" 
                      size={24} 
                      color={paymentMethod === 'Kredi Kartı' ? "#fff" : "#333"} 
                    />
                    <Text 
                      style={[
                        styles.paymentOptionText,
                        paymentMethod === 'Kredi Kartı' && styles.activePaymentOptionText
                      ]}
                    >
                      Kredi Kartı
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.paymentOption,
                      paymentMethod === 'Nakit' && styles.activePaymentOption
                    ]}
                    onPress={() => setPaymentMethod('Nakit')}
                  >
                    <MaterialIcons 
                      name="attach-money" 
                      size={24} 
                      color={paymentMethod === 'Nakit' ? "#fff" : "#333"} 
                    />
                    <Text 
                      style={[
                        styles.paymentOptionText,
                        paymentMethod === 'Nakit' && styles.activePaymentOptionText
                      ]}
                    >
                      Nakit
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Toplam:</Text>
              <Text style={styles.totalValue}>₺{getCartTotal().toFixed(2)}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.checkoutButton}
              onPress={completeOrder}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.checkoutButtonText}>Siparişi Tamamla</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyCartContainer}>
            <MaterialIcons name="shopping-basket" size={64} color="#ccc" />
            <Text style={styles.emptyCartText}>Sepetiniz boş</Text>
          </View>
        )}
      </Animated.View>
      
      {/* Sipariş Özeti Kapatılsa Bile Görünen Hızlı Erişim Düğmeleri */}
      {cart.length > 0 && !cartVisible && (
        <View style={styles.quickAccessContainer}>
          <TouchableOpacity 
            style={styles.floatingCart}
            onPress={toggleCart}
          >
            <View style={styles.floatingCartContent}>
              <View style={styles.floatingCartBadge}>
                <Text style={styles.floatingCartBadgeText}>
                  {cart.reduce((total, item) => total + item.quantity, 0)}
                </Text>
              </View>
              <MaterialIcons name="shopping-cart" size={24} color="#fff" />
              <Text style={styles.floatingCartTotal}>₺{getCartTotal().toFixed(2)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.completeOrderButton}
            onPress={directCompleteOrder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.completeOrderContent}>
                <MaterialIcons name="check-circle" size={24} color="#fff" />
                <Text style={styles.completeOrderText}>Siparişi Tamamla</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cartIconContainer: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#e53935',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    padding: 8,
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  categoryContainer: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryList: {
    paddingHorizontal: 10,
  },
  categoryItem: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCategoryItem: {
    backgroundColor: '#1e3a8a',
  },
  categoryText: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  activeCategoryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  productList: {
    paddingHorizontal: 10,
    paddingBottom: 100, // Floating cart için alt boşluğu artırıyorum (80'den 100'e)
  },
  productCard: {
    width: '47%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    margin: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  productImageContainer: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    width: '100%',
    alignItems: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 5,
    height: 40,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
  },
  cartContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 80,
    maxHeight: '90%',
    zIndex: 1001,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cartContent: {
    maxHeight: '100%',
    paddingBottom: 20,
  },
  cartList: {
    paddingHorizontal: 15,
    maxHeight: 150,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  cartItemPrice: {
    fontSize: 13,
    color: '#00a86b',
    marginTop: 5,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemButton: {
    width: 28,
    height: 28,
    backgroundColor: '#f0f0f0',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  cartDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 10,
    marginHorizontal: 15,
  },
  paymentSection: {
    paddingHorizontal: 15,
    marginTop: 5,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  activePaymentOption: {
    backgroundColor: '#1e3a8a',
  },
  paymentOptionText: {
    marginLeft: 8,
    fontWeight: 'bold',
    color: '#333',
  },
  activePaymentOptionText: {
    color: '#fff',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 15,
    marginVertical: 15,
    backgroundColor: '#fff',
    paddingTop: 10,
    zIndex: 100,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00a86b',
  },
  checkoutButton: {
    backgroundColor: '#00a86b',
    paddingVertical: 18,
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 65,
    alignItems: 'center',
    position: 'relative',
    zIndex: 101,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyCartContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartText: {
    fontSize: 16,
    color: '#777',
    marginTop: 10,
  },
  quickAccessContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  floatingCart: {
    flex: 1,
    backgroundColor: '#1e3a8a',
    borderRadius: 10,
    marginRight: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  floatingCartContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    position: 'relative',
  },
  floatingCartBadge: {
    position: 'absolute',
    top: -8,
    left: 0,
    backgroundColor: '#e53935',
    borderRadius: 10,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  floatingCartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  floatingCartTotal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  completeOrderButton: {
    backgroundColor: '#00a86b',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  completeOrderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#777',
    marginTop: 10,
  },
});

export default POSScreen; 