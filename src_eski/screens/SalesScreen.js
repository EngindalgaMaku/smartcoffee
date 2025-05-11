import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
  Alert
} from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isMobile = width < 768;
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 20 : StatusBar.currentHeight || 0;

const SalesScreen = ({ branchId }) => {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');
  const [saleDetails, setSaleDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableSaleData, setEditableSaleData] = useState(null);
  const [grandTotalAmount, setGrandTotalAmount] = useState(0);
  const [productSelectionModalVisible, setProductSelectionModalVisible] = useState(false);
  const [allProductsForSelection, setAllProductsForSelection] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Sayfalama için state'ler
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10); // Sabit değer 10
  const [totalCount, setTotalCount] = useState(0);
  // const [totalPages, setTotalPages] = useState(0); // totalPages might not be strictly needed for UI if not displayed

  // FlatList referansı
  const flatListRef = React.useRef();

  // İlk yükleme
  useEffect(() => {
    setCurrentPage(0);
    setSales([]);
    setFilteredSales([]);
    setGrandTotalAmount(0);
    fetchSales(0, true);
  }, [branchId, sortOrder]);

  // Arama metni değiştiğinde filtreleme
  useEffect(() => {
    filterSales();
  }, [searchText, sales]);

  // Satışları veritabanından getir
  const fetchSales = async (pageToFetch, isNewQuery = false) => {
    if (loadingMore && !isNewQuery) return;

    if (isNewQuery) {
    setLoading(true);
      setSales([]);
      setFilteredSales([]);
      setGrandTotalAmount(0);
    } else {
      setLoadingMore(true);
    }
    
    try {
      // const todayFilter = getTodayDateFilter(); // <<-- GÜNLÜK FİLTRE KALDIRILDI
      
      // Önce toplam sayıyı ve toplam tutarı çekelim
      
      // Toplam adet sorgusu (Yeniden yapılandırıldı)
      let countPipeline = supabase
        .from('sales')
        .select('*', { count: 'exact', head: true });
      
      if (branchId) {
        countPipeline = countPipeline.eq('branch_id', branchId);
      }
      // Bugün filtresi kaldırıldı
      // countPipeline = countPipeline.gte('sale_time', todayFilter.startDate.toISOString());
      // countPipeline = countPipeline.lte('sale_time', todayFilter.endDate.toISOString());
      
      const { count, error: countError } = await countPipeline;
      
      if (countError) {
        console.error("Toplam sayı sorgusu hatası:", countError);
      } else {
        setTotalCount(count || 0);
      }

      // Toplam tutar sorgusu
      // Supabase doğrudan SUM gibi aggregations için RPC veya view önerebilir,
      // ama client-side'da bu şekilde de yapılabilir (çok büyük veri setleri için ideal değil)
      // Daha iyi bir yol, .rpc() ile bir database fonksiyonu çağırmak olabilir.
      // Şimdilik, tüm filtrelenmiş satışların toplamını almak için ayrı bir sorgu yapıyoruz.
      // Bu, eğer çok fazla satış varsa performansı etkileyebilir.
      // Not: Bu tüm filtrelenmiş kayıtların toplamını alır, sadece o anki sayfanın değil.

      let sumQuery = supabase.from('sales').select('total_amount');
      if (branchId) {
        sumQuery = sumQuery.eq('branch_id', branchId);
      }
      // Bugün filtresi kaldırıldı
      // sumQuery = sumQuery.gte('sale_time', todayFilter.startDate.toISOString());
      // sumQuery = sumQuery.lte('sale_time', todayFilter.endDate.toISOString());

      const { data: sumData, error: sumError } = await sumQuery;

      if (sumError) {
        console.error("Toplam tutar sorgusu hatası:", sumError);
      } else if (sumData) {
        const totalSum = sumData.reduce((acc, sale) => acc + (sale.total_amount || 0), 0);
        setGrandTotalAmount(totalSum);
      }
      
      // Şimdi bu sayfadaki verileri çekelim
      let query = supabase
        .from('sales')
        .select('*');
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      // Bugün filtresi kaldırıldı
      // query = query.gte('sale_time', todayFilter.startDate.toISOString());
      // query = query.lte('sale_time', todayFilter.endDate.toISOString());
      
      // Sıralama - created_at yerine sale_time kullan
      query = query.order('sale_time', { ascending: sortOrder === 'asc' });
      
      // Sayfalama uygula
      const from = pageToFetch * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Veritabanı sorgu hatası:", error);
        throw error;
      }
      
      if (data && data.length > 0) {
        console.log("Satış verileri yüklendi:", data.length);
        
        // Siparişleri dönüştür
        const salesWithoutDetails = await Promise.all(data.map(async (sale) => {
          // Şube bilgilerini ayrı bir sorgu ile al
          let branchName = 'Bilinmeyen Şube';
          try {
            if (sale.branch_id) {
              const { data: branchData, error: branchError } = await supabase
                .from('branches')
                .select('name')
                .eq('id', sale.branch_id)
                .single();
                
              if (!branchError && branchData) {
                branchName = branchData.name;
              }
            }
          } catch (err) {
            console.log("Şube bilgileri alınırken hata:", err);
          }
          
          // Ödeme yöntemi bilgilerini ayrı bir sorgu ile al
          let paymentMethod = 'Nakit';
          try {
            if (sale.payment_method_id) {
              const { data: paymentData, error: paymentError } = await supabase
                .from('payment_methods')
                .select('name')
                .eq('id', sale.payment_method_id)
                .single();
                
              if (!paymentError && paymentData) {
                paymentMethod = paymentData.name;
              }
            }
          } catch (err) {
            console.log("Ödeme yöntemi bilgileri alınırken hata:", err);
          }
          
          // Kasiyer adını user_id kullanarak profiles tablosundan çek
          let cashierName = 'Sistem'; // Default value
          try {
            if (sale.user_id) { // Check if user_id exists on the sale object
              const { data: profileData, error: profileError } = await supabase
                .from('profiles') // Assuming your user profiles table is named 'profiles'
                .select('full_name') // Assuming the display name column is 'full_name'
                .eq('id', sale.user_id) // Match profile id with sale.user_id
                .single();

              if (profileError) {
                console.log("Kasiyer profil bilgisi alınırken hata:", profileError.message);
              } else if (profileData && profileData.full_name) {
                cashierName = profileData.full_name;
              } else {
                console.log(`Kasiyer adı bulunamadı user_id: ${sale.user_id}`);
              }
            }
          } catch (err) {
            console.log("Kasiyer adı çekilirken genel hata:", err);
          }
          
          return {
            id: sale.id,
            orderNumber: `Satış ID: ${sale.id.toString().substring(0, 8)}`,
            date: new Date(sale.sale_time),
            formattedDate: formatDateWithTime(new Date(sale.sale_time)),
            amount: sale.total_amount || 0,
            paymentMethod: paymentMethod,
            status: sale.status || 'completed',
            branchId: sale.branch_id,
            branchName: branchName,
            cashier: cashierName, // Use the fetched or default cashierName
            products: [] // Ürünler sonradan yüklenecek
          };
        }));
        
        // Her satış için ürün detaylarını ayrı ayrı çekelim
        const salesWithDetails = await Promise.all(
          salesWithoutDetails.map(async (sale) => {
            // Satış detaylarını al - Önce sale_items tablosunu kontrol et
            try {
              const { data: saleItems, error: detailsError } = await supabase
                .from('sale_items')
                .select('*') // Daha spesifik alanlar seçilebilir: 'product_id, quantity, unit_price, products(name)')
                .eq('sale_id', sale.id);
              
              if (detailsError) {
                console.error(`Sale ID ${sale.id} için detay sorgu hatası:`, detailsError);
                sale.products = []; // Hata durumunda boş ürün listesi
              } else if (saleItems && saleItems.length > 0) {
                const products = await Promise.all(saleItems.map(async (item) => {
                  let productName = 'Bilinmeyen Ürün';
                  let productCategory = 'Kategorisiz';
                  // Eğer product_id varsa, ürün adını ve kategorisini çek
                    if (item.product_id) {
                    try {
                      const { data: productData, error: productError } = await supabase
                        .from('products')
                        .select('name, categories(name)')
                        .eq('id', item.product_id)
                        .single();
                      if (productError) {
                        console.error(`Product ID ${item.product_id} için ürün bilgisi alınırken hata:`, productError);
                      } else if (productData) {
                        productName = productData.name;
                        productCategory = productData.categories ? productData.categories.name : 'Kategorisiz';
                      }
                    } catch (e) {
                      console.error(`Product ID ${item.product_id} için ürün bilgisi çekilirken kritik hata:`, e);
                    }
                  }
                  return {
                    id: item.id, // sale_items.id
                    product_id: item.product_id,
                    name: productName,
                    category: productCategory,
                    quantity: item.quantity || 0,
                    price: item.unit_price || 0,
                    totalPrice: (item.quantity || 0) * (item.unit_price || 0),
                  };
                }));
                sale.products = products;
              } else {
                // Hiç sale_items yoksa boş ürün listesi
                console.log(`Sale ID ${sale.id} için ürün detayı bulunamadı, ürünler boş ayarlandı.`);
                sale.products = [];
              }
            } catch (e) {
              console.error(`Sale ID ${sale.id} için ürün detayları alınırken kritik hata:`, e);
              sale.products = []; // Kritik hata durumunda da boş ürün listesi
            }
            return sale;
          })
        );
        
        if (isNewQuery) {
        setSales(salesWithDetails);
        } else {
          setSales(prevSales => [...prevSales, ...salesWithDetails]);
        }
        setFilteredSales(salesWithDetails);
        console.log('Satışlar başarıyla yüklendi:', salesWithDetails.length);
      } else {
        console.log('Hiç satış verisi bulunamadı.'); // Mock veri üretimi kaldırıldı
        if (isNewQuery) { // Sadece yeni sorgu ise sıfırla, loadMore sırasında değil
            setSales([]);
            setFilteredSales([]);
            setGrandTotalAmount(0); // Toplam tutar da sıfırlanmalı
            setTotalCount(0);
        }
      }
    } catch (error) {
      console.error('Satışlar yüklenirken hata:', error);
      if (isNewQuery) { // Hata durumunda da state'leri sıfırla (sadece ilk yüklemede)
        setSales([]);
        setFilteredSales([]);
        setGrandTotalAmount(0);
        setTotalCount(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Sipariş detaylarını getir
  const fetchOrderDetails = async (orderId) => {
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', orderId);
      
      if (error) {
        console.error("Detay sorgulama hatası:", error);
        throw error;
      }
      
      if (data && data.length > 0) {
        // Her ürün için ismi ayrı bir sorgu ile al
        const detailsWithProducts = await Promise.all(data.map(async (item) => {
          let productName = 'Bilinmeyen Ürün';
          
          try {
            if (item.product_id) {
              const { data: productData, error: productError } = await supabase
                .from('products')
                .select('name')
                .eq('id', item.product_id)
                .single();
                
              if (!productError && productData) {
                productName = productData.name;
              }
            }
          } catch (err) {
            console.log("Ürün bilgileri alınırken hata:", err);
          }
          
          return {
            id: item.id,
            productName: productName,
            quantity: item.quantity || 1,
            unitPrice: item.price_at_sale || 0,
            totalPrice: (item.price_at_sale || 0) * (item.quantity || 1)
          };
        }));
        
        setSaleDetails(detailsWithProducts);
      } else {
        // Detay bulunamazsa boş array göster
        setSaleDetails([]);
      }
    } catch (error) {
      console.error('Sipariş detayları yüklenirken hata:', error);
      setSaleDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Sipariş detaylarını göster
  const showOrderDetails = (order) => {
    setSelectedSale(order);
    setEditableSaleData(JSON.parse(JSON.stringify(order)));
    setIsEditMode(false);
    setDetailModalVisible(true);
  };

  // Sipariş silme
  const deleteSale = (saleId) => {
    Alert.alert(
      "Siparişi Sil",
      "Bu siparişi silmek istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Sil", 
          style: "destructive",
          onPress: async () => {
            try {
              // Önce sipariş detaylarını sil
              const { error: detailsError } = await supabase
                .from('sale_items')
                .delete()
                .eq('sale_id', saleId);
                
              if (detailsError) throw detailsError;
              
              // Sonra siparişi sil
              const { error } = await supabase
                .from('sales')
                .delete()
                .eq('id', saleId);
                
              if (error) throw error;
              
              // Başarılı silme işlemi
              Alert.alert("Başarılı", "Sipariş başarıyla silindi");
              fetchSales(currentPage, true); // Listeyi yenile
            } catch (error) {
              console.error('Sipariş silinirken hata:', error);
              Alert.alert("Hata", "Sipariş silinirken bir hata oluştu");
            }
          }
        }
      ]
    );
  };

  // Arama metnine göre satışları filtrele
  const filterSales = () => {
    if (!searchText.trim()) {
      setFilteredSales(sales);
      return;
    }
    
    const searchLower = searchText.toLowerCase();
    const filtered = sales.filter(sale => 
      sale.orderNumber.toLowerCase().includes(searchLower) ||
      sale.branchName.toLowerCase().includes(searchLower) ||
      sale.amount.toString().includes(searchLower) ||
      sale.paymentMethod.toLowerCase().includes(searchLower) ||
      sale.cashier.toLowerCase().includes(searchLower) ||
      sale.formattedDate.toLowerCase().includes(searchLower) ||
      // Ürün adlarında ara
      sale.products.some(product => 
        product.name.toLowerCase().includes(searchLower)
      )
    );
    
    setFilteredSales(filtered);
  };

  // Sıralama düzenini değiştir
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  // Para birimi formatı
  const formatCurrency = (value) => {
    if (typeof value !== 'number') {
      console.warn('formatCurrency received non-number:', value, 'Returning ₺0,00');
      return '₺0,00'; 
    }
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Tarih formatı (saat:dakika:saniye dahil)
  const formatDateWithTime = (date) => {
    return `(${date.toLocaleDateString('tr-TR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit'
    })} ${date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })})`;
  };

  // Sadece tarih formatı
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date); // Gelen date string ise Date objesine çevir
    return d.toLocaleDateString('tr-TR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Sipariş durumu formatı
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return '#4CAF50';
      case 'processing': return '#2196F3';
      case 'cancelled': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  // Sipariş durumu metni
  const getStatusText = (status) => {
    switch(status) {
      case 'completed': return 'Tamamlandı';
      case 'processing': return 'İşleniyor';
      case 'cancelled': return 'İptal Edildi';
      default: return 'Bilinmiyor';
    }
  };

  const calculateTotalAmount = (products) => {
    if (!products || !Array.isArray(products)) {
      return 0;
    }
    return products.reduce((sum, product) => {
      const price = product.price_at_sale || product.price || 0;
      const quantity = product.quantity || 0;
      return sum + (price * quantity);
    }, 0);
  };

  // Ürün bilgilerini düzenleme modunda güncellemek için yardımcı fonksiyon
  const handleProductPropertyChange = (text, productIndex, propertyName) => {
    const newProducts = [...editableSaleData.products];
    const productToUpdate = { ...newProducts[productIndex] };

    let numericValue = parseFloat(text);
    if (propertyName === 'quantity') {
      numericValue = parseInt(text, 10);
    }

    if (isNaN(numericValue)) {
      // Eğer kullanıcı geçersiz bir sayı girerse (örn: harf) veya boş bırakırsa,
      // 0 olarak kabul edebilir veya alanı boş bırakmasına izin verebiliriz.
      // Şimdilik 0 yapalım veya boşsa son geçerli değeri koruyalım.
      // Eğer boş string ise, belki 0 atamak daha iyi olur.
      numericValue = 0; 
    }
    
    productToUpdate[propertyName] = numericValue;

    // Fiyat veya miktar değiştiğinde, o ürünün toplam fiyatını da güncelleyebiliriz (eğer varsa)
    // Ancak genel toplamı zaten calculateTotalAmount hesaplayacak.

    newProducts[productIndex] = productToUpdate;
    setEditableSaleData(prevData => ({
      ...prevData,
      products: newProducts
    }));
  };

  const handleDeleteProduct = (productIndex) => {
    const currentProducts = editableSaleData.products || [];
    const updatedProducts = currentProducts.filter((_, index) => index !== productIndex);
    setEditableSaleData(prevData => ({
      ...prevData,
      products: updatedProducts
    }));
  };

  // Bu fonksiyon artık ürün seçim modalını açacak
  const openProductSelectionModal = async () => {
    if (allProductsForSelection.length === 0) { // Ürünler daha önce çekilmediyse çek
      await fetchProductsForSelection();
    }
    setProductSelectionModalVisible(true);
  };

  const fetchProductsForSelection = async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, stock_quantity') // İhtiyaç duyulan alanlar
        .order('name', { ascending: true });

      if (error) {
        console.error("Ürünler çekilirken hata:", error);
        Alert.alert("Hata", "Ürün listesi yüklenemedi.");
        setAllProductsForSelection([]);
      } else {
        setAllProductsForSelection(data || []);
      }
    } catch (err) {
      console.error("fetchProductsForSelection genel hata:", err);
      Alert.alert("Hata", "Ürün listesi yüklenirken bir sorun oluştu.");
      setAllProductsForSelection([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Ürün seçim modalından bir ürün seçildiğinde çağrılacak fonksiyon
  const handleProductSelected = (product) => {
    if (!product || !product.id) {
      Alert.alert("Hata", "Geçersiz ürün seçildi.");
      return;
    }

    const newSaleItem = {
      product_id: product.id,          // Gerçek ürün ID'si
      name: product.name,              // Seçilen ürünün adı
      quantity: 1,                     // Varsayılan miktar
      price_at_sale: product.price,    // Ürünün o anki fiyatı satış fiyatı olarak alınır
      price: product.price,            // Ana ürün fiyatı (referans için)
      temp_id: `new-${Date.now()}`     // Yeni eklendiğini belirtmek için geçici ID
    };

    setEditableSaleData(prevData => ({
      ...prevData,
      products: [...(prevData.products || []), newSaleItem]
    }));
    setProductSelectionModalVisible(false); // Seçim sonrası modalı kapat
  };

  // Bu fonksiyon, modal içinde düzenleme modundayken her bir ürün satırını render eder.
  const renderEditableProductItem = (product, index) => {
    const itemPrice = product.price_at_sale || product.price || 0;
    const itemQuantity = product.quantity || 0;
    // Ürünün kendi ID'si (sale_items tablosundaki ID) veya geçici ID
    const productKey = product.id || product.temp_id || `product-${index}`;


    if (isEditMode) {
      return (
        <View key={productKey} style={styles.editableProductItemContainer}>
          <Text style={styles.editableProductNameFixed}>{product.name || 'Bilinmeyen Ürün'}</Text>
          <TextInput
            style={styles.editableNumericInput}
            value={String(itemQuantity)}
            onChangeText={(text) => handleProductPropertyChange(text, index, 'quantity')}
            keyboardType="numeric"
            selectTextOnFocus
          />
          {/* Birim Fiyat - Düzenlenemez */}
          <Text style={styles.editablePriceTextDisplay}>{formatCurrency(itemPrice)}</Text>
          
          <Text style={styles.editableProductTotalPrice}>{formatCurrency(itemPrice * itemQuantity)}</Text>
          <TouchableOpacity onPress={() => handleDeleteProduct(index)} style={styles.deleteItemButton}>
            <Ionicons name="remove-circle-outline" size={24} color="#FF6347" />
          </TouchableOpacity>
        </View>
      );
    }

    // Görüntüleme modu (isEditMode false ise)
    return (
      <View key={productKey} style={styles.editableProductItemContainer}>
        <Text style={styles.editableProductName}>{product.name || 'Bilinmeyen Ürün'}</Text>
        <Text style={styles.editableProductQuantity}>{itemQuantity} adet</Text>
        <Text style={styles.editableProductPrice}>{formatCurrency(itemPrice)}</Text>
        <Text style={styles.editableProductTotalPrice}>{formatCurrency(itemPrice * itemQuantity)}</Text>
      </View>
    );
  };

  // Örnek satış verisi oluştur
  const generateMockSales = (count) => {
    const mockSales = [];
    const now = new Date();
    
    for (let i = 1; i <= count; i++) {
      const saleDate = new Date(now);
      saleDate.setHours(now.getHours() - i * 2); // Her sipariş arası 2 saat
      
      const mockProducts = [];
      // Rastgele 1-3 ürün ekle
      const productCount = Math.floor(Math.random() * 3) + 1;
      
      let total = 0;
      for (let j = 1; j <= productCount; j++) {
        const quantity = Math.floor(Math.random() * 2) + 1;
        const price = (Math.floor(Math.random() * 40) + 10) * 5; // 50 ile 250 arası, 5'in katları
        const productTotal = quantity * price;
        total += productTotal;
        
        mockProducts.push({
          id: `${i}-${j}`,
          name: getRandomProductName(),
          quantity,
          price,
          totalPrice: productTotal
        });
      }
      
      mockSales.push({
        id: `${i}${i}${i}${i}${i}${i}${i}${i}`,
        orderNumber: `Satış ID: ${i}${i}${i}${i}${i}${i}`,
        date: saleDate,
        formattedDate: formatDateWithTime(saleDate),
        amount: total,
        paymentMethod: Math.random() > 0.7 ? 'Nakit' : 'Kredi Kartı',
        status: Math.random() > 0.8 ? 'processing' : 'completed',
        branchName: Math.random() > 0.5 ? 'Gemlik Şubesi' : 'Bursa Şubesi',
        products: mockProducts,
        cashier: 'Umut Dalga'
      });
    }
    
    return mockSales;
  };

  // Rastgele ürün adı seç
  const getRandomProductName = () => {
    const products = [
      'ICE AMERICANO (BÜYÜK)',
      'ICE AMERICANO (KÜÇÜK)',
      'EXTRA SHOT',
      'ICE AROMALI (BÜYÜK)',
      'Kurabiye',
      'CAPPUCCINO',
      'FLAT WHITE'
    ];
    
    return products[Math.floor(Math.random() * products.length)];
  };

  // Sipariş listesi öğesini render et - web görünümüne benzer
  const renderSaleItem = ({ item, index }) => (
    <TouchableOpacity onPress={() => showOrderDetails(item)} style={styles.saleItemContainer}>
      <View style={styles.saleItemHeader}>
        <Text style={styles.orderNumber}>{item.orderNumber} - {item.branchName}</Text>
        <Text style={styles.dateText}>{item.formattedDate}</Text>
      </View>
      <View style={styles.saleItemBody}>
        <View style={styles.saleItemRow}>
          <Text style={styles.amountLabel}>Toplam Tutar:</Text>
          <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
        </View>
        <View style={styles.saleItemRow}>
          <Text style={styles.infoLabel}>Ödeme:</Text>
          <Text style={styles.infoValue}>{item.paymentMethod}</Text>
        </View>
        <View style={styles.saleItemRow}>
          <Text style={styles.infoLabel}>Kasiyer:</Text>
          <Text style={styles.infoValue}>{item.cashier}</Text>
        </View>
        <View style={[styles.saleItemRow, styles.statusRow]}>
          <Text style={styles.infoLabel}>Durum:</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
      </View>
      
      {/* Satılan Ürünler Başlığı */}
      {item.products && item.products.length > 0 && (
        <View style={styles.productsSection}>
          <Text style={styles.productsSectionTitle}>Satılan Ürünler:</Text>
          {item.products.map((product, pIndex) => (
            <View key={`${item.id}-product-${pIndex}`} style={styles.productDetailItem}>
              <Text style={styles.productNameText}>
                {product.name || 'Bilinmeyen Ürün'}
              </Text>
              <Text style={styles.productQuantityText}>
                {product.quantity} adet
              </Text>
              <Text style={styles.productPriceText}>
                {formatCurrency(product.price_at_sale || product.price || 0)} / adet
              </Text>
          </View>
        ))}
      </View>
      )}
      
      {/* Silme Butonu - Sağ Üst Köşeye Taşındı */}
        <TouchableOpacity 
        style={styles.deleteButtonTopRight}
        onPress={(e) => { 
          e.stopPropagation(); // Modalın açılmasını engelle
          deleteSale(item.id); 
        }}
      >
        <Ionicons name="trash-outline" size={22} color="#FF6347" />
        </TouchableOpacity>
        </TouchableOpacity>
  );

  const renderListFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.footerLoadingText}>Daha fazla yükleniyor...</Text>
    </View>
  );
  };

  // Sipariş detayını render et
  const renderOrderDetailItem = ({ item }) => (
    <View style={styles.detailItem}>
      <View style={styles.detailItemHeader}>
        <Text style={styles.detailItemName}>{item.productName}</Text>
        <Text style={styles.detailItemTotal}>{formatCurrency(item.totalPrice)}</Text>
      </View>
      
      <View style={styles.detailItemFooter}>
        <Text style={styles.detailItemQuantity}>{item.quantity} x {formatCurrency(item.unitPrice)}</Text>
      </View>
    </View>
  );

  const loadMoreItems = () => {
    if (loadingMore) return;
    
    const nextPage = currentPage + 1;
    if (nextPage * pageSize < totalCount) {
      console.log(`Loading more items, page: ${nextPage}`);
      setCurrentPage(nextPage);
      fetchSales(nextPage, false);
    } else {
      console.log('No more sales to load.');
    }
  };

  const handleSaveSaleChanges = async () => {
    if (!editableSaleData || !editableSaleData.id || !selectedSale) {
      Alert.alert("Hata", "Kaydedilecek veya karşılaştırılacak satış verisi bulunamadı.");
      return;
    }

    setLoading(true); // Veya ayrı bir saving state

    const originalProducts = selectedSale.products || [];
    const editedProducts = editableSaleData.products || [];

    try {
      // 1. Silinecek ürünleri belirle ve sil (sale_items)
      const productsToDelete = originalProducts.filter(
        originalProduct => !editedProducts.find(p => p.id === originalProduct.id)
      );
      for (const product of productsToDelete) {
        if (!product.id) continue; // Orijinal üründe ID olmalı
        const { error: deleteError } = await supabase
          .from('sale_items')
          .delete()
          .eq('id', product.id);
        if (deleteError) {
          throw new Error(`Ürün silinirken hata (${product.name || 'ID: ' + product.id}): ${deleteError.message}`);
        }
      }

      // 2. Güncellenecek veya eklenecek ürünleri işle (sale_items)
      for (const editedProduct of editedProducts) {
        const originalProduct = originalProducts.find(p => p.id === editedProduct.id);

        if (originalProduct) { // Var olan bir ürün, güncelleme kontrolü
          if (originalProduct.quantity !== editedProduct.quantity || 
              (originalProduct.price_at_sale || originalProduct.price) !== (editedProduct.price_at_sale || editedProduct.price)
             ) { // Miktar VEYA fiyat değiştiyse (fiyat şuan değişmiyor ama geleceğe hazırlık)
            const { error: updateError } = await supabase
              .from('sale_items')
              .update({
                quantity: editedProduct.quantity,
                // price_at_sale: editedProduct.price_at_sale || editedProduct.price, // Fiyat düzenlemesi aktif değil
              })
              .eq('id', editedProduct.id);
            if (updateError) {
              throw new Error(`Ürün güncellenirken hata (${editedProduct.name || 'ID: ' + editedProduct.id}): ${updateError.message}`);
            }
          }
        } else { // Yeni ürün (ID'si yok veya originalProducts'ta bulunamadı)
          // Yeni ürünlerin `product_id`si ve diğer gerekli bilgilerinin olması lazım.
          // Geçici `temp_id`leri olan ürünler burada işlenebilir.
          if (editedProduct.temp_id) { // Placeholder ile eklenmiş yeni ürün
            console.log("Yeni ürün ekleme denemesi:", editedProduct);
            // product_id'nin null olmasından dolayı burada hata bekleniyor.
            const { error: insertError } = await supabase
              .from('sale_items')
              .insert([{
                sale_id: editableSaleData.id,
                product_id: editedProduct.product_id, // BU DEĞER NULL OLDUĞU İÇİN HATA VERECEKTİR
                quantity: editedProduct.quantity,
                price_at_sale: editedProduct.price_at_sale || editedProduct.price || 0,
              }]);
            if (insertError) {
              console.error("Yeni ürün eklenirken Supabase hatası:", insertError);
              throw new Error(`Yeni ürün (${editedProduct.name}) eklenirken veritabanı hatası: ${insertError.message}. Lütfen bir ürün seçin.`);
            }
          }
        }
      }

      // 3. Ana satış kaydını (sales) güncelle
      const newTotalAmount = calculateTotalAmount(editedProducts);
      // Ödeme yöntemi ID'sini al (eğer string ise)
      // Bu kısım, ödeme yöntemlerinin nasıl yönetildiğine bağlı olarak daha karmaşık olabilir.
      // Şimdilik editableSaleData.payment_method_id olduğunu varsayıyoruz.
      let paymentMethodIdToSave = editableSaleData.payment_method_id;
      if (typeof editableSaleData.paymentMethod === 'string' && !editableSaleData.payment_method_id) {
        // Eğer sadece paymentMethod adı varsa ve ID yoksa, ID'yi bulmamız gerekir.
        // Bu örnekte, `payment_methods` tablosundan bir arama simüle edilebilir veya önceden yüklenmiş olabilir.
        // console.warn("payment_method_id eksik, paymentMethod adına göre bulunması gerekiyor.");
        // Örnek: const foundMethod = allPaymentMethods.find(m => m.name === editableSaleData.paymentMethod);
        // if (foundMethod) paymentMethodIdToSave = foundMethod.id;
      }

      const { data: saleUpdateData, error: saleUpdateError } = await supabase
        .from('sales')
        .update({
          total_amount: newTotalAmount,
          payment_method_id: paymentMethodIdToSave, 
          updated_at: new Date().toISOString(),
        })
        .eq('id', editableSaleData.id);

      if (saleUpdateError) {
        throw new Error(`Ana satış kaydı güncellenirken hata: ${saleUpdateError.message}`);
      }

      Alert.alert("Başarılı", "Satış başarıyla güncellendi.");
      setIsEditMode(false);
      setDetailModalVisible(false);
      fetchSales(currentPage, true); 

    } catch (error) {
      console.error("Satış güncellenirken hata:", error);
      Alert.alert("Güncelleme Hatası", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    // Değişiklikleri geri al (orijinal selectedSale verisine dön)
    setEditableSaleData(JSON.parse(JSON.stringify(selectedSale))); 
    setIsEditMode(false);
    // Eğer kullanıcı doğrudan düzenleme modunda modalı açtıysa (gelecekteki bir özellik),
    // o zaman setDetailModalVisible(false) da çağrılabilir.
    // Şimdilik sadece düzenleme modundan çıkıyoruz.
  };

  // Tarih aralığına göre filtre oluştur (Sadece bugünü döndürecek şekilde güncellendi)
  const getTodayDateFilter = () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startDate, endDate };
  };

  return (
    <View style={styles.safeContainer}>
      <StatusBar backgroundColor="#f5f5f5" barStyle="dark-content" />
      
      {/* Çok daha fazla boşluk ekleyerek içeriği aşağı alıyorum */}
      <View style={styles.superExtraTopPadding} />
      
      <View style={styles.container}>
        {/* Başlık */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Satışlar</Text>
          <TouchableOpacity 
            style={styles.sortButton}
            onPress={toggleSortOrder}
          >
            <Ionicons 
              name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
              size={20} 
              color="#333" 
            />
          </TouchableOpacity>
        </View>
        
        {/* Toplam Satış Bilgileri -- YENİ BÖLÜM */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Toplam Satış</Text>
            <Text style={styles.summaryValue}>{formatCurrency(grandTotalAmount)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Toplam Adet</Text>
            <Text style={styles.summaryValue}>{totalCount}</Text>
          </View>
        </View>
        
        {/* Arama çubuğu */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Satış ID, Müşteri Email, Ürün"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        {/* Satış listesi */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1e3a8a" />
            <Text style={styles.loadingText}>Satışlar yükleniyor...</Text>
          </View>
        ) : filteredSales.length > 0 ? (
          <>
            <FlatList
              data={filteredSales}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={renderSaleItem}
              contentContainerStyle={styles.salesListContent}
              ref={flatListRef}
              onEndReached={loadMoreItems}
              onEndReachedThreshold={0.5} // Trigger onEndReached when last item is 0.5 of screen height away
              ListFooterComponent={renderListFooter} // Footer loading indicator
            />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Satış bulunamadı</Text>
          </View>
        )}
      </View>
      
      {/* Sipariş detay modalı */}
      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsEditMode(false);
          setDetailModalVisible(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditMode ? "Satışı Düzenle" : "Sipariş Detayı"}
              </Text>
              {!isEditMode && (
                <TouchableOpacity onPress={() => setIsEditMode(true)} style={styles.editModeButton}>
                  <Ionicons name="pencil" size={20} color="#1e3a8a" />
                  <Text style={styles.editModeButtonText}>Düzenle</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => {
                setIsEditMode(false);
                setDetailModalVisible(false);
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {editableSaleData && (
              <FlatList
                style={{ flex: 1 }} // Replaces ScrollView's flex: 1 behavior
                data={loadingDetails ? [] : (editableSaleData.products || [])}
                renderItem={({ item: product, index }) => renderEditableProductItem(product, index)}
                keyExtractor={(pItem, pIndex) => pItem.id || pItem.temp_id || `product-${pIndex}`}
                ListHeaderComponent={
                  <>
              <View style={styles.selectedSaleSummary}>
                      <Text style={styles.selectedSaleNumber}>{editableSaleData.orderNumber}</Text>
                      <Text style={styles.selectedSaleDate}>{formatDate(new Date(editableSaleData.date))}</Text>
                
                <View style={styles.selectedSaleInfo}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Şube:</Text>
                          {isEditMode ? (
                            <TextInput 
                              style={styles.editableTextInput}
                              value={editableSaleData.branchName} 
                              editable={false}
                            />
                          ) : (
                            <Text style={styles.infoValue}>{editableSaleData.branchName}</Text>
                          )}
                  </View>
                  
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Ödeme:</Text>
                          {isEditMode ? (
                            <TextInput 
                              style={styles.editableTextInput}
                              value={editableSaleData.paymentMethod} 
                              onChangeText={(text) => setEditableSaleData({...editableSaleData, paymentMethod: text})} 
                            />
                          ) : (
                            <Text style={styles.infoValue}>{editableSaleData.paymentMethod}</Text>
                          )}
                  </View>
                  
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Kasiyer:</Text>
                          {isEditMode ? (
                            <TextInput 
                              style={styles.editableTextInput}
                              value={editableSaleData.cashier} 
                              editable={false}
                            />
                          ) : (
                            <Text style={styles.infoValue}>{editableSaleData.cashier}</Text>
                          )}
                  </View>
                  
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Durum:</Text>
                          {isEditMode ? (
                            <TextInput 
                              style={styles.editableTextInput}
                              value={editableSaleData.status} 
                              onChangeText={(text) => setEditableSaleData({...editableSaleData, status: text})} 
                            />
                          ) : (
                            <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(editableSaleData.status) }]}>
                              <Text style={styles.statusTextSmall}>{getStatusText(editableSaleData.status)}</Text>
                    </View>
                          )}
                  </View>
                </View>
              </View>
            
            <View style={styles.modalDivider} />
            
            <Text style={styles.detailSectionTitle}>Ürünler</Text>
                  </>
                }
                ListFooterComponent={
                  <>
                    {isEditMode && (
                      <TouchableOpacity onPress={openProductSelectionModal} style={styles.addProductButton}>
                        <Ionicons name="add-circle-outline" size={22} color="#1e3a8a" />
                        <Text style={styles.addProductButtonText}>Ürün Ekle</Text>
                      </TouchableOpacity>
                    )}
                    
                    {editableSaleData && ( // Total amount should always be part of the scrollable content
                      <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>Toplam:</Text>
                        <Text style={styles.totalAmount}>{formatCurrency(calculateTotalAmount(editableSaleData.products))}</Text>
                      </View>
                    )}
                  </>
                }
                ListEmptyComponent={
                  loadingDetails ? (
              <View style={styles.detailLoadingContainer}>
                <ActivityIndicator size="small" color="#1e3a8a" />
                <Text style={styles.detailLoadingText}>Detaylar yükleniyor...</Text>
              </View>
                  ) : (
                    <Text style={styles.noDetailsText}>Ürün bulunamadı</Text>
                  )
                }
              />
            )}

            {isEditMode && (
              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={handleCancelEdit}>
                  <Text style={styles.modalButtonText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveSaleChanges}>
                  <Text style={styles.modalButtonText}>Değişiklikleri Kaydet</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
      {/* Ürün Seçim Modalı */}
      <ProductSelectionModal 
        visible={productSelectionModalVisible}
        onClose={() => setProductSelectionModalVisible(false)}
        products={allProductsForSelection}
        onProductSelect={handleProductSelected}
        loading={loadingProducts}
      />
    </View>
  );
};

const ProductSelectionModal = ({ visible, onClose, products, onProductSelect, loading }) => {
  const renderProductSelectItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.productSelectItem}
      onPress={() => onProductSelect(item)}
    >
      <View style={styles.productSelectItemInfo}>
        <Text style={styles.productSelectItemName}>{item.name}</Text>
        <Text style={styles.productSelectItemStock}>Stok: {item.stock_quantity === null || item.stock_quantity === undefined ? 'N/A' : item.stock_quantity}</Text>
      </View>
      <Text style={styles.productSelectItemPrice}>{formatCurrency(item.price)}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.productSelectionModalContainer}> 
        <View style={styles.productSelectionModalContent}>
          <View style={styles.productSelectionModalHeader}>
            <Text style={styles.productSelectionModalTitle}>Ürün Seç</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centeredLoader}>
              <ActivityIndicator size="large" color="#1e3a8a" />
              <Text>Ürünler yükleniyor...</Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.centeredMessageContainer}>
              <Text style={styles.centeredMessageText}>Kayıtlı ürün bulunamadı.</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              renderItem={renderProductSelectItem}
              keyExtractor={(item) => item.id.toString()}
              style={styles.productSelectionList}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  superExtraTopPadding: {
    height: 0, // Önce vardı, şimdi sıfıra indirelim
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginHorizontal: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sortButton: {
    padding: 5,
  },
  dateFilterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingTop: 5,
  },
  dateFilterContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 5,
  },
  dateFilterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  activeDateFilterOption: {
    backgroundColor: '#1e3a8a',
  },
  dateFilterText: {
    fontSize: 14,
    color: '#333',
  },
  activeDateFilterText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    marginTop: 16,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  salesList: {
    flex: 1,
  },
  salesListContent: {
    padding: 12,
    paddingBottom: 80, // Sabit sayfalama kontrollerinin altında içerik kalmaması için
  },
  saleItemContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'visible', // Silme butonu için visible olabilir ya da padding ile ayarlanır
    position: 'relative', // Silme butonunun pozisyonlanması için
  },
  saleItemHeader: {
    padding: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  saleItemBody: {
    paddingHorizontal: 12,
    paddingVertical: 8, // Üst ve alt boşluğu azalttık
    // borderBottomWidth: 1, // Kaldırıldı, ürünler bölümü kendi ayırıcısını kullanabilir
    // borderBottomColor: '#eee',
  },
  saleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6, // Satırlar arası boşluk
  },
  statusRow: {
    marginBottom: 0, // Durum satırı için alt boşluğu kaldır
  },
  amountContainer: { // Bu stil artık doğrudan kullanılmıyor, saleItemRow ve amountLabel/Text kullanılıyor
    marginBottom: 5,
  },
  amountLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  amountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007bff', // Mavi renk vurgusu
  },
  infoLabel: {
    fontSize: 14,
    color: '#555',
    marginRight: 5,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'right',
  },
  statusContainer: { // Bu stil artık doğrudan kullanılmıyor, saleItemRow ve statusBadge kullanılıyor
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    fontWeight: 'bold',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  saleItemFooter: { // Bu stil artık doğrudan kullanılmıyor, bilgiler body içine taşındı
    padding: 8,
    backgroundColor: '#fff',
  },
  paymentMethodText: { // infoValue veya benzeri stillerle birleştirildi
    fontSize: 14,
    color: '#666',
  },
  cashierText: { // infoValue veya benzeri stillerle birleştirildi
    fontSize: 14,
    color: '#666',
  },
  deleteButton: { // Bu stil adı deleteButtonTopRight olarak değişti ve güncellendi
    padding: 10,
    borderRadius: 4,
    backgroundColor: '#f44336',
  },
  deleteButtonTopRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // Hafif transparan arka plan
    borderRadius: 20, // Yuvarlak buton
    zIndex: 1, // Diğer elemanların üzerinde kalması için
  },
  productsSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 8, 
  },
  productsSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  productDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5', // Çok hafif bir ayırıcı
  },
  productNameText: {
    flex: 2, // Ürün adı daha fazla yer kaplasın
    fontSize: 13,
    color: '#444',
  },
  productQuantityText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  productPriceText: {
    flex: 1.5, // Fiyat biraz daha fazla yer kaplasın
    fontSize: 13,
    color: '#444',
    textAlign: 'right',
    fontWeight: '500',
  },
  footerLoadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '50%',
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedSaleSummary: {
    padding: 16,
  },
  selectedSaleNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  selectedSaleDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  selectedSaleInfo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  detailItemTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  detailItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailItemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  noDetailsText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00a86b',
  },
  editModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  editModeButtonText: {
    marginLeft: 5,
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  editableTextInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: 5,
    fontSize: 14,
    color: '#333',
    textAlign: 'right',
  },
  modalBodyScrollView: {
    flex: 1,
  },
  editableProductItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16, // modalContent padding'i ile uyumlu olabilir
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  editableProductName: {
    flex: 2,
    fontSize: 14,
    color: '#333',
  },
  editableProductNameFixed: { // Düzenleme modunda ürün adı için, flex ile diğer inputlara yer açar
    flex: 1.5, // Diğer inputlar için biraz daha az yer
    fontSize: 14,
    color: '#333',
    marginRight: 5, // Input ile arasında boşluk
  },
  editableProductQuantity: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  editableProductPrice: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    textAlign: 'right',
  },
  editableProductTotalPrice: {
    flex: 1.5,
    fontSize: 14,
    color: '#333',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  editableNumericInput: {
    flex: 0.8, // Miktar ve fiyat inputları için daha dar alan
    borderBottomWidth: 1,
    borderColor: '#007bff',
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    paddingHorizontal: 4,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginHorizontal: 2,
  },
  editablePriceTextDisplay: { // Düzenlenemeyen fiyat için stil
    flex: 1,
    fontSize: 14,
    color: '#333',
    textAlign: 'right',
    paddingHorizontal: 4, // editableNumericInput ile benzer padding
    marginHorizontal: 2,
  },
  deleteItemButton: {
    paddingLeft: 8, // TotalPrice ile arasında boşluk
    justifyContent: 'center',
    alignItems: 'center',
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 16, // modalContent paddingi ile uyumlu
    marginTop: 10,
    backgroundColor: '#e8f0fe',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  addProductButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  summaryContainer: { // YENİ STİL
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff', // Veya header ile aynı renk
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginTop:0, // Header'dan sonra boşluk olmaması için
  },
  summaryBox: { // YENİ STİL
    alignItems: 'center',
    paddingHorizontal:10,
  },
  summaryLabel: { // YENİ STİL
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  summaryValue: { // YENİ STİL
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  productSelectionModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', // İçeriği dikeyde ortala
    alignItems: 'center',    // İçeriği yatayda ortala
  },
  productSelectionModalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 0, // Başlık ve liste kendi padding'ini yönetecek
    width: '90%', // Ekran genişliğinin %90'ı
    maxHeight: '80%', // Ekran yüksekliğinin %80'i
    overflow: 'hidden', // border-radius'un FlatList'i kesmesi için
  },
  productSelectionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  productSelectionModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  productSelectionList: {
    // FlatList'in maxHeight'i productSelectionModalContent tarafından yönetiliyor
  },
  productSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productSelectItemInfo: {
    flex: 1, // İsim ve stok için daha fazla alan
    marginRight: 10, 
  },
  productSelectItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  productSelectItemStock: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  productSelectItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  centeredLoader: {
    flex: 1, // Eğer FlatList yoksa alanı kaplaması için
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredMessageContainer: {
    flex: 1, // Eğer FlatList yoksa alanı kaplaması için
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredMessageText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
});

export default SalesScreen; 