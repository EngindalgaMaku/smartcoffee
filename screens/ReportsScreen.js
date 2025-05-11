import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  FlatList
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';
import { Calendar } from 'react-native-calendars';

const ReportsScreen = ({ branchId }) => {
  // State tanımlamaları
  const [loading, setLoading] = useState(false);
  const [activeReportType, setActiveReportType] = useState('sales'); // 'sales', 'products', 'stock'
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(branchId || null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)), // Son 30 gün
    endDate: new Date()
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('start'); // 'start' veya 'end'
  const [reportData, setReportData] = useState([]);
  const [summaryData, setSummaryData] = useState({
    totalSales: 0,
    transactionCount: 0,
    averageOrder: 0
  });
  // Satışlar Raporu için Sayfalama State'leri
  const [salesCurrentPage, setSalesCurrentPage] = useState(0);
  const [salesPageSize, setSalesPageSize] = useState(50); // Varsayılan 50 satış
  const [salesTotalCount, setSalesTotalCount] = useState(0);
  const [salesLoadingMore, setSalesLoadingMore] = useState(false);
  const [allSalesLoaded, setAllSalesLoaded] = useState(false); // Tüm satışların yüklenip yüklenmediğini takip et
  
  // Tarih formatlama yardımcı fonksiyonu
  const formatDate = (date, format = 'DD/MM/YYYY') => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    if (format === 'YYYY-MM-DD') {
      return `${year}-${month}-${day}`;
    }
    return `${day}/${month}/${year}`;
  };

  // Şubeleri getir
  useEffect(() => {
    async function fetchBranches() {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .order('name');
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          setBranches(data);
          if (!selectedBranchId) {
            setSelectedBranchId(data[0].id);
          }
        }
      } catch (error) {
        console.error('Şubeler yüklenirken hata:', error);
      }
    }
    
    fetchBranches();
  }, []);

  // Rapor verilerini getir
  useEffect(() => {
    if (selectedBranchId) {
      // Rapor türü veya tarih aralığı değiştiğinde, satışlar için sayfalamayı sıfırla
      if (activeReportType === 'sales') {
        setSalesCurrentPage(0);
        setReportData([]); // Önceki verileri temizle
        setAllSalesLoaded(false);
      }
      fetchReportData();
    }
  }, [selectedBranchId, activeReportType, dateRange]);

  // String'den Date oluştur (DD/MM/YYYY formatı)
  const parseDate = (dateStr) => {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed in JS
      const year = parseInt(parts[2], 10);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    return null;
  };

  // Tarih seçimi işleyicisi
  const handleDateChange = () => {
    if (!tempDate) return;
    
    const newDate = parseDate(tempDate);
    if (newDate) {
      if (datePickerMode === 'start') {
        setDateRange({...dateRange, startDate: newDate});
      } else {
        setDateRange({...dateRange, endDate: newDate});
      }
      setShowDatePicker(false);
    } else {
      alert('Lütfen geçerli bir tarih giriniz (GG/AA/YYYY)');
    }
  };

  // Calendar onDayPress handler
  const onDayPress = (day) => {
    const newDate = new Date(day.year, day.month - 1, day.day);
    if (datePickerMode === 'start') {
      setDateRange({ ...dateRange, startDate: newDate });
    } else {
      setDateRange({ ...dateRange, endDate: newDate });
    }
    setShowDatePicker(false);
  };

  // Tarih seçim modalını aç
  const showDatePickerModal = (mode) => {
    setDatePickerMode(mode);
    // setTempDate(formatDate(mode === 'start' ? dateRange.startDate : dateRange.endDate)); // No longer needed
    setShowDatePicker(true);
  };

  // Rapor verilerini getir
  const fetchReportData = async () => {
    if (!selectedBranchId) return;
    
    setLoading(true); // Genel yükleme durumu, ilk sayfa için
    // salesLoadingMore, sayfa sonuna gelindiğinde kullanılır
    
    try {
      const startDateStr = dateRange.startDate.toISOString();
      const endDateStr = new Date(dateRange.endDate.setHours(23, 59, 59, 999)).toISOString();
      
      if (activeReportType === 'sales') {
        // Özet verileri her zaman tüm aralık için çek (sayfalamadan bağımsız)
        await fetchSalesSummary(startDateStr, endDateStr);
        // Satış listesini sayfalama ile çek (ilk sayfa için)
        await fetchSalesReportPage(startDateStr, endDateStr, 0);
      } else if (activeReportType === 'products') {
        await fetchProductsReport(startDateStr, endDateStr);
      } else if (activeReportType === 'stock') {
        await fetchStockReport();
      }
      
    } catch (error) {
      console.error('Rapor verileri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  // Satış Raporu için ÖZET VERİLERİ Çekme
  const fetchSalesSummary = async (startDateStr, endDateStr) => {
    try {
      const { data: summarySalesData, error: summaryError } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('branch_id', selectedBranchId)
        .gte('sale_time', startDateStr)
        .lte('sale_time', endDateStr);

      if (summaryError) throw summaryError;

      if (summarySalesData && summarySalesData.length > 0) {
        const totalSales = summarySalesData.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
        const transactionCount = summarySalesData.length; // Bu, toplam işlem sayısı olacak
        const averageOrder = transactionCount > 0 ? totalSales / transactionCount : 0;
        
        setSummaryData({
          totalSales,
          transactionCount,
          averageOrder
        });
      } else {
        setSummaryData({
          totalSales: 0,
          transactionCount: 0,
          averageOrder: 0
        });
      }
    } catch (error) {
      console.error('Satış özet verileri yüklenirken hata:', error);
      // Hata durumunda özet verileri sıfırla veya kullanıcıya bilgi ver
      setSummaryData({
        totalSales: 0,
        transactionCount: 0,
        averageOrder: 0
      });
    }
  };

  // Satış raporu verileri - SAYFALAMA İLE
  const fetchSalesReportPage = async (startDateStr, endDateStr, page) => {
    if (page === 0) {
      setReportData([]); // Yeni bir sorgu başlangıcında (örn: tarih değişimi) eski veriyi temizle
      setAllSalesLoaded(false);
    } else {
      setSalesLoadingMore(true); // Sadece sonraki sayfalar yüklenirken true yap
    }

    try {
      const from = page * salesPageSize;
      const to = from + salesPageSize - 1;

      // Sayfalama ile satış listesini getir
      const { data: salesData, error: salesError, count } = await supabase
        .from('sales')
        .select(`
          id,
          sale_time,
          total_amount,
          payment_methods (name)
        `, { count: 'exact' }) // Toplam sayıyı almak için count: 'exact'
        .eq('branch_id', selectedBranchId)
        .gte('sale_time', startDateStr)
        .lte('sale_time', endDateStr)
        .order('sale_time', { ascending: false })
        .range(from, to);
        
      if (salesError) throw salesError;
      
      if (salesData) {
        setSalesTotalCount(count || 0); // Toplam satış sayısını state'e kaydet
        setReportData(prevData => page === 0 ? salesData : [...prevData, ...salesData]);
        setSalesCurrentPage(page);
        if (salesData.length < salesPageSize || (page + 1) * salesPageSize >= count) {
          setAllSalesLoaded(true);
        }
      } else {
        if (page === 0) setReportData([]); // Eğer ilk sayfada veri yoksa boşalt
      }
      
    } catch (error) {
      console.error('Sayfalı satış raporu verileri yüklenirken hata:', error);
      if (page === 0) setReportData([]); // Hata durumunda ilk sayfayı boşalt
    } finally {
      if (page > 0) {
        setSalesLoadingMore(false); // Sayfa yüklemesi bittiğinde false yap
      }
    }
  };

  // Daha Fazla Satış Yükle
  const loadMoreSales = () => {
    if (loading || salesLoadingMore || allSalesLoaded) {
      return; // Zaten yükleniyorsa veya tümü yüklendiyse bir şey yapma
    }
    const nextPage = salesCurrentPage + 1;
    const startDateStr = dateRange.startDate.toISOString();
    const endDateStr = new Date(dateRange.endDate.setHours(23, 59, 59, 999)).toISOString();
    fetchSalesReportPage(startDateStr, endDateStr, nextPage);
  };

  // Satış raporu verileri
  const fetchSalesReport = async (startDateStr, endDateStr) => {
    try {
      // Toplam satışları getir
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_time,
          total_amount,
          payment_methods (name)
        `)
        .eq('branch_id', selectedBranchId)
        .gte('sale_time', startDateStr)
        .lte('sale_time', endDateStr)
        .order('sale_time', { ascending: false });
        
      if (salesError) throw salesError;
      
      if (salesData && salesData.length > 0) {
        // Özet verileri hesapla
        const totalSales = salesData.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
        const transactionCount = salesData.length;
        const averageOrder = totalSales / transactionCount;
        
        setSummaryData({
          totalSales,
          transactionCount,
          averageOrder
        });
        
        setReportData(salesData);
      } else {
        setSummaryData({
          totalSales: 0,
          transactionCount: 0,
          averageOrder: 0
        });
        setReportData([]);
      }
      
    } catch (error) {
      console.error('Satış raporu verileri yüklenirken hata:', error);
    }
  };

  // Ürün raporu verileri
  const fetchProductsReport = async (startDateStr, endDateStr) => {
    try {
      // Satış detaylarını getir ve ürünlere göre grupla
      const { data: salesItemsData, error: salesItemsError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_items(
            product_id,
            quantity,
            price_at_sale,
            products(name, category_id, categories(name))
          )
        `)
        .eq('branch_id', selectedBranchId)
        .gte('sale_time', startDateStr)
        .lte('sale_time', endDateStr);
        
      if (salesItemsError) throw salesItemsError;
      
      if (salesItemsData && salesItemsData.length > 0) {
        // Ürünleri grupla ve satış sayılarını topla
        const productSales = {};
        let totalQuantity = 0;
        let totalRevenue = 0;
        
        salesItemsData.forEach(sale => {
          if (sale.sale_items && sale.sale_items.length > 0) {
            sale.sale_items.forEach(item => {
              const productId = item.product_id;
              const productName = item.products?.name || 'Bilinmeyen Ürün';
              const categoryName = item.products?.categories?.name || 'Kategorisiz';
              const quantity = item.quantity || 0;
              const revenue = (item.price_at_sale * quantity) || 0;
              
              totalQuantity += quantity;
              totalRevenue += revenue;
              
              if (!productSales[productId]) {
                productSales[productId] = {
                  id: productId,
                  name: productName,
                  category: categoryName,
                  quantity: 0,
                  revenue: 0
                };
              }
              
              productSales[productId].quantity += quantity;
              productSales[productId].revenue += revenue;
            });
          }
        });
        
        // Objeyi diziye çevir ve satış miktarına göre sırala
        const productList = Object.values(productSales)
          .sort((a, b) => b.quantity - a.quantity);
          
        setSummaryData({
          totalSales: totalRevenue,
          totalQuantity: totalQuantity,
          productCount: productList.length
        });
        
        setReportData(productList);
      } else {
        setSummaryData({
          totalSales: 0,
          totalQuantity: 0,
          productCount: 0
        });
        setReportData([]);
      }
      
    } catch (error) {
      console.error('Ürün raporu verileri yüklenirken hata:', error);
    }
  };

  // Stok raporu verileri
  const fetchStockReport = async () => {
    try {
      // Stok verilerini getir
      const { data: stockData, error: stockError } = await supabase
        .from('branch_ingredient_stock') // Query branch_ingredient_stock table
        .select(`
          stock_level,
          ingredients (
            id,
            name,
            unit,
            low_stock_threshold
          )
        `)
        .eq('branch_id', selectedBranchId) // Filter by selected branch
        .order('name', { foreignTable: 'ingredients', ascending: true }); // Order by ingredient name correctly
        
      if (stockError) throw stockError;
      
      if (stockData && stockData.length > 0) {
        // Transform data to match existing structure and calculate stock summary
        const transformedData = stockData.map(item => ({
          id: item.ingredients.id,
          name: item.ingredients.name,
          unit: item.ingredients.unit,
          stock_quantity: item.stock_level,
          low_stock_threshold: item.ingredients.low_stock_threshold
        }));

        const lowStockItems = transformedData.filter(item => 
          item.stock_quantity < (item.low_stock_threshold || 0)
        );
        
        setSummaryData({
          totalIngredients: transformedData.length,
          lowStockCount: lowStockItems.length,
        });
        
        setReportData(transformedData);
      } else {
        setSummaryData({
          totalIngredients: 0,
          lowStockCount: 0,
        });
        setReportData([]);
      }
      
    } catch (error) {
      console.error('Stok raporu verileri yüklenirken hata:', error);
    }
  };

  // Para formatı
  const formatCurrency = (amount) => {
    return `₺${parseFloat(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Satış raporu item render
  const renderSalesItem = ({ item, index }) => {
    const date = new Date(item.sale_time);
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    return (
      <View style={styles.tableRow}>
        <Text style={[styles.tableCell, { flex: 0.5 }]}>{index + 1}</Text>
        <Text style={[styles.tableCell, { flex: 1 }]}>{formattedDate}</Text>
        <Text style={[styles.tableCell, { flex: 1 }]}>{formattedTime}</Text>
        <Text style={[styles.tableCell, { flex: 1.2 }]}>{item.payment_methods?.name || '-'}</Text>
        <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(item.total_amount)}</Text>
      </View>
    );
  };

  // Ürün raporu item render
  const renderProductItem = ({ item, index }) => {
    return (
      <View style={styles.tableRow}>
        <Text style={[styles.tableCell, { flex: 0.5 }]}>{index + 1}</Text>
        <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.name}</Text>
        <Text style={[styles.tableCell, { flex: 1 }]}>{item.category}</Text>
        <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'center' }]}>{item.quantity}</Text>
        <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(item.revenue)}</Text>
      </View>
    );
  };

  // Stok raporu item render
  const renderStockItem = ({ item, index }) => {
    return (
      <View style={styles.tableRow}>
        <Text style={[styles.tableCell, { flex: 0.5 }]}>{index + 1}</Text>
        <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.name}</Text>
        <Text style={[styles.tableCell, { flex: 0.7 }]}>{item.unit}</Text>
        <View style={[styles.tableCell, { flex: 0.8 }]}>
          <View style={[
            styles.stockIndicator, 
            { backgroundColor: item.stock_quantity < (item.low_stock_threshold || 0) ? '#f44336' : (item.stock_quantity < (item.low_stock_threshold || 0) * 1.5 ? '#ff9800' : '#4caf50') }
          ]}>
            <Text style={styles.stockText}>{item.stock_quantity}</Text>
          </View>
        </View>
        <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'center' }]}>{item.low_stock_threshold || 0}</Text>
      </View>
    );
  };

  // Satış raporu tablo başlığı
  const renderSalesTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>#</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Tarih</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Saat</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Ödeme Yöntemi</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Tutar</Text>
    </View>
  );

  // Ürün raporu tablo başlığı
  const renderProductsTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>#</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Ürün</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Kategori</Text>
      <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'center' }]}>Adet</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Ciro</Text>
    </View>
  );

  // Stok raporu tablo başlığı
  const renderStockTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>#</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Malzeme</Text>
      <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Birim</Text>
      <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Stok</Text>
      <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>Min. Stok</Text>
    </View>
  );

  // Satışlar listesi için footer (daha fazla yükleniyor göstergesi)
  const renderSalesListFooter = () => {
    if (!salesLoadingMore) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Raporlar</Text>
      </View>
      
      <View style={styles.filterContainer}>
        <View style={styles.reportTypeContainer}>
          <TouchableOpacity 
            style={[styles.reportTypeButton, activeReportType === 'sales' && styles.activeReportType]}
            onPress={() => setActiveReportType('sales')}
          >
            <Ionicons 
              name="bar-chart" 
              size={20} 
              color={activeReportType === 'sales' ? '#fff' : '#333'} 
              style={styles.reportTypeIcon}
            />
            <Text style={[styles.reportTypeText, activeReportType === 'sales' && styles.activeReportTypeText]}>
              Satış
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.reportTypeButton, activeReportType === 'products' && styles.activeReportType]}
            onPress={() => setActiveReportType('products')}
          >
            <Ionicons 
              name="cafe" 
              size={20} 
              color={activeReportType === 'products' ? '#fff' : '#333'} 
              style={styles.reportTypeIcon}
            />
            <Text style={[styles.reportTypeText, activeReportType === 'products' && styles.activeReportTypeText]}>
              Ürün
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.reportTypeButton, activeReportType === 'stock' && styles.activeReportType]}
            onPress={() => setActiveReportType('stock')}
          >
            <Ionicons 
              name="cube" 
              size={20} 
              color={activeReportType === 'stock' ? '#fff' : '#333'} 
              style={styles.reportTypeIcon}
            />
            <Text style={[styles.reportTypeText, activeReportType === 'stock' && styles.activeReportTypeText]}>
              Stok
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.filterRow}>
          <View style={styles.dateRangeContainer}>
            <Text style={styles.filterLabel}>Tarih Aralığı:</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => showDatePickerModal('start')}
            >
              <Ionicons name="calendar" size={18} color="#333" style={styles.dateIcon} />
              <Text style={styles.dateText}>{formatDate(dateRange.startDate)}</Text>
            </TouchableOpacity>
            
            <Text style={styles.filterLabel}>-</Text>
            
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => showDatePickerModal('end')}
            >
              <Ionicons name="calendar" size={18} color="#333" style={styles.dateIcon} />
              <Text style={styles.dateText}>{formatDate(dateRange.endDate)}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={fetchReportData}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.summaryContainer}>
        {activeReportType === 'sales' && (
          <>
            <View style={styles.summaryCard}>
              <Ionicons name="cash-outline" size={24} color="#1e3a8a" style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>Toplam Satış</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summaryData.totalSales)}</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Ionicons name="receipt-outline" size={24} color="#1e3a8a" style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>İşlem Sayısı</Text>
              <Text style={styles.summaryValue}>{summaryData.transactionCount}</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Ionicons name="stats-chart-outline" size={24} color="#1e3a8a" style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>Ortalama Sepet</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summaryData.averageOrder)}</Text>
            </View>
          </>
        )}
        
        {activeReportType === 'products' && (
          <>
            <View style={styles.summaryCard}>
              <Ionicons name="cash-outline" size={24} color="#1e3a8a" style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>Toplam Ciro</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summaryData.totalSales)}</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Ionicons name="cafe-outline" size={24} color="#1e3a8a" style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>Satılan Ürün</Text>
              <Text style={styles.summaryValue}>{summaryData.totalQuantity || 0} adet</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Ionicons name="apps-outline" size={24} color="#1e3a8a" style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>Farklı Ürün</Text>
              <Text style={styles.summaryValue}>{summaryData.productCount || 0}</Text>
            </View>
          </>
        )}
        
        {activeReportType === 'stock' && (
          <>
            <View style={styles.summaryCard}>
              <Ionicons name="cube-outline" size={24} color="#1e3a8a" style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>Toplam Malzeme</Text>
              <Text style={styles.summaryValue}>{summaryData.totalIngredients || 0}</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Ionicons name="warning-outline" size={24} color="#f44336" style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>Düşük Stok</Text>
              <Text style={styles.summaryValue}>{summaryData.lowStockCount || 0}</Text>
            </View>
          </>
        )}
      </View>
      
      <View style={styles.tableContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1e3a8a" />
            <Text style={styles.loadingText}>Rapor verileri yükleniyor...</Text>
          </View>
        ) : reportData.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="information-circle-outline" size={50} color="#888" />
            <Text style={styles.noDataText}>
              Seçilen filtreler için veri bulunamadı.
            </Text>
          </View>
        ) : (
          <>
            {activeReportType === 'sales' && (
              <>
                {renderSalesTableHeader()}
                <FlatList
                  data={reportData}
                  renderItem={renderSalesItem}
                  keyExtractor={(item) => item.id.toString()}
                  ListHeaderComponent={renderSalesTableHeader}
                  showsVerticalScrollIndicator={false}
                  // Satışlar raporu için sayfalama özellikleri
                  onEndReached={loadMoreSales}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={renderSalesListFooter}
                />
              </>
            )}
            
            {activeReportType === 'products' && (
              <>
                {renderProductsTableHeader()}
                <FlatList
                  data={reportData}
                  renderItem={renderProductItem}
                  keyExtractor={(item) => item.id.toString()}
                />
              </>
            )}
            
            {activeReportType === 'stock' && (
              <>
                {renderStockTableHeader()}
                <FlatList
                  data={reportData}
                  renderItem={renderStockItem}
                  keyExtractor={(item) => item.id.toString()}
                />
              </>
            )}
          </>
        )}
      </View>
      
      {/* Tarih seçici modal */}
      {showDatePicker && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerContainer}>
              <Text style={styles.datePickerTitle}>
                {datePickerMode === 'start' ? 'Başlangıç Tarihi' : 'Bitiş Tarihi'}
              </Text>
              
              {/* <TextInput
                style={styles.dateInput}
                value={tempDate}
                onChangeText={setTempDate}
                placeholder="GG/AA/YYYY"
                keyboardType="number-pad"
                maxLength={10}
              /> */}

              <Calendar
                current={formatDate(datePickerMode === 'start' ? dateRange.startDate : dateRange.endDate, 'YYYY-MM-DD')}
                onDayPress={onDayPress}
                markedDates={{
                  [formatDate(datePickerMode === 'start' ? dateRange.startDate : dateRange.endDate, 'YYYY-MM-DD')]: {selected: true, marked: true, selectedColor: '#1e3a8a'}
                }}
                monthFormat={'yyyy MMMM'}
                // theme={{
                //   selectedDayBackgroundColor: '#1e3a8a',
                //   arrowColor: '#1e3a8a',
                //   todayTextColor: '#1e3a8a',
                //   // Diğer tema ayarları eklenebilir
                // }}
              />
              
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={[styles.datePickerButton, {backgroundColor: '#f44336'}]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.datePickerButtonText}>İptal</Text>
                </TouchableOpacity>
                
                {/* <TouchableOpacity 
                  style={styles.datePickerButton}
                  onPress={handleDateChange} // This button might not be needed if selection happens onDayPress
                >
                  <Text style={styles.datePickerButtonText}>Tamam</Text>
                </TouchableOpacity> */}
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    marginBottom: 5,
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  reportTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  reportTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 15,
    flex: 1,
    marginHorizontal: 5,
  },
  activeReportType: {
    backgroundColor: '#1e3a8a',
  },
  reportTypeIcon: {
    marginRight: 8,
  },
  reportTypeText: {
    color: '#333',
    fontWeight: 'bold',
  },
  activeReportTypeText: {
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
  },
  filterLabel: {
    marginRight: 5,
    color: '#666',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  dateIcon: {
    marginRight: 5,
  },
  dateText: {
    fontSize: 14,
    color: '#333',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryIcon: {
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    color: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  tableCell: {
    fontSize: 14,
    color: '#333',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  datePickerModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  /* dateInput: { // No longer needed
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    width: '100%',
    fontSize: 16,
    textAlign: 'center',
  }, */
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  datePickerButton: {
    backgroundColor: '#1e3a8a',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  datePickerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stockIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  stockText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default ReportsScreen; 