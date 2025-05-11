import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, SafeAreaView, Dimensions, Animated, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons, MaterialIcons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import POSScreen from './POSScreen';
import SalesScreen from './SalesScreen';
import ProductsScreen from './ProductsScreen';
import CategoriesScreen from './CategoriesScreen';
import IngredientsScreen from './IngredientsScreen';
import BranchesScreen from './BranchesScreen';
import UsersScreen from './UsersScreen';
import PaymentsScreen from './PaymentsScreen';
import ReportsScreen from './ReportsScreen';
import ProfileScreen from './ProfileScreen';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;

// Logo resmi yerine placeholder kullanacağız
const PLACEHOLDER_LOGO = { uri: 'https://via.placeholder.com/30' };
// Logo için coffee-logo.png kullanacağız
const SIDEBAR_LOGO = require('../assets/coffee-logo.png');

export default function DashboardScreen({ navigation }) {
  const [selectedBranch, setSelectedBranch] = useState('Gemlik Şubesi');
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [menuVisible, setMenuVisible] = useState(!isMobile);
  const slideAnim = useState(new Animated.Value(isMobile ? -250 : 0))[0];
  const [userData, setUserData] = useState(null);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [branchDropdownVisible, setBranchDropdownVisible] = useState(false);
  
  // Veri state'leri
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salesData, setSalesData] = useState({
    dailySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    totalProducts: 0,
    hourlyTransactions: 0,
    hourlySalesAmount: 0,
    dailyTransactions: 0,
    weeklyTransactions: 0,
    monthlyTransactions: 0
  });
  const [topProducts, setTopProducts] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  // Satış grafiği state'i
  const [salesChartData, setSalesChartData] = useState({
    labels: ["", "", "", "", "", "", ""],
    datasets: [
      {
        data: [0, 0, 0, 0, 0, 0, 0],
        color: (opacity = 1) => `rgba(0, 102, 255, ${opacity})`,
        strokeWidth: 2
      }
    ]
  });

  const toggleMenu = () => {
    const toValue = menuVisible ? -250 : 0;
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setMenuVisible(!menuVisible);
  };

  const toggleProfileMenu = () => {
    setProfileMenuVisible(!profileMenuVisible);
  };

  const formatCurrency = (value) => {
    return `₺${value.toLocaleString('tr-TR')}`;
  };

  // Kullanıcı bilgilerini getir (göstermeyeceğiz ama state'i tutacağız)
  useEffect(() => {
    async function fetchUserData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Profil bilgilerini al
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (profileError) {
            console.error('Profil bilgisi alınamadı:', profileError);
            setUserData({ name: 'Kullanıcı' }); // Varsayılan değer
          } else if (profileData) {
            setUserData(profileData);
          } else {
            setUserData({ name: 'Kullanıcı' }); // Profil bulunamadıysa
          }
        }
      } catch (error) {
        console.error('Kullanıcı verisi alınamadı:', error);
        setUserData({ name: 'Kullanıcı' }); // Hata durumunda varsayılan değer
      }
    }
    
    fetchUserData();
  }, []);

  // Şubeleri getir
  useEffect(() => {
    async function fetchBranches() {
      try {
        // Önce veritabanından şubeleri çekmeyi deneyelim
        const { data, error } = await supabase
          .from('branches')
          .select('*');
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          console.log("Veritabanından şubeler yüklendi:", data.length);
          setBranches(data);
          // Varsayılan olarak ilk şubeyi seç
          if (!selectedBranchId) {
            setSelectedBranchId(data[0].id);
            setSelectedBranch(data[0].name);
          }
        } else {
          // Veritabanında şube bulunamadıysa varsayılan şubeleri kullanalım
          console.log("Veritabanında şube bulunamadı, varsayılan şubeler kullanılıyor");
          const defaultBranches = [
            { id: 1, name: 'Gemlik Şubesi', address: 'Gemlik, Bursa', phone: '+90 555 123 4567' },
            { id: 2, name: 'Bursa Şubesi', address: 'Nilüfer, Bursa', phone: '+90 555 987 6543' }
          ];
          
          setBranches(defaultBranches);
          
          // Varsayılan şubeleri veritabanına eklemeyi deneyelim
          try {
            const { error: insertError } = await supabase
              .from('branches')
              .upsert(defaultBranches);
              
            if (insertError) console.error("Şubeler veritabanına eklenirken hata:", insertError);
            else console.log("Varsayılan şubeler veritabanına eklendi");
          } catch (insertErr) {
            console.error("Şubeler veritabanına eklenirken hata:", insertErr);
          }
          
          // Varsayılan olarak ilk şubeyi seç
          setSelectedBranchId(defaultBranches[0].id);
          setSelectedBranch(defaultBranches[0].name);
        }
      } catch (error) {
        console.error('Şubeler yüklenirken hata:', error);
        
        // Hata durumunda yine varsayılan şubeleri gösterelim
        const fallbackBranches = [
          { id: 1, name: 'Gemlik Şubesi', address: 'Gemlik, Bursa', phone: '+90 555 123 4567' },
          { id: 2, name: 'Bursa Şubesi', address: 'Nilüfer, Bursa', phone: '+90 555 987 6543' }
        ];
        
        setBranches(fallbackBranches);
        setSelectedBranchId(fallbackBranches[0].id);
        setSelectedBranch(fallbackBranches[0].name);
        
        // Kullanıcıya bilgi verelim
        alert("Şubeler yüklenirken bir hata oluştu. Varsayılan şubeler gösteriliyor.");
      }
    }
    
    fetchBranches();
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!selectedBranchId) {
      setLoading(false);
      setRefreshing(false);
      // Clear data if no branch is selected
      setSalesData({
        dailySales: 0,
        weeklySales: 0,
        monthlySales: 0,
        totalProducts: 0,
        hourlyTransactions: 0,
        hourlySalesAmount: 0,
        dailyTransactions: 0,
        weeklyTransactions: 0,
        monthlyTransactions: 0
      });
      setTopProducts([]);
      setLowStockItems([]);
      setSalesChartData({
        labels: ["", "", "", "", "", "", ""],
        datasets: [ { data: [0, 0, 0, 0, 0, 0, 0] } ]
      });
      return;
    }

    // setLoading(true); // setLoading will be handled by onRefresh or initial load
    
    try {
      // Gerçek verileri Supabase'den çekelim
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - (today.getDay() || 7) + 1); // Pazartesiden başla
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(today);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      let dailySalesTotal = 0;
      let weeklySalesTotal = 0;
      let monthlySalesTotal = 0;
      let dailyTransactions = 0;
      let weeklyTransactions = 0;
      let monthlyTransactions = 0;
      let hourlyTransactions = 0;
      let hourlySalesTotal = 0;
      
      try {
        // Günlük satışları getir
        const { data: dailySalesData, error: dailyError } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('branch_id', selectedBranchId)
          .gte('sale_time', startOfDay.toISOString());
        
        if (!dailyError && dailySalesData) {
          dailyTransactions = dailySalesData.length;
          dailySalesTotal = dailySalesData.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
          console.log(`Günlük satış: ${dailySalesTotal} TL, ${dailyTransactions} işlem`);
        }
        
        // Haftalık satışları getir
        const { data: weeklySalesData, error: weeklyError } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('branch_id', selectedBranchId)
          .gte('sale_time', startOfWeek.toISOString());
        
        if (!weeklyError && weeklySalesData) {
          weeklyTransactions = weeklySalesData.length;
          weeklySalesTotal = weeklySalesData.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
          console.log(`Haftalık satış: ${weeklySalesTotal} TL, ${weeklyTransactions} işlem`);
        }
        
        // Aylık satışları getir
        const { data: monthlySalesData, error: monthlyError } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('branch_id', selectedBranchId)
          .gte('sale_time', startOfMonth.toISOString());
        
        if (!monthlyError && monthlySalesData) {
          monthlyTransactions = monthlySalesData.length;
          monthlySalesTotal = monthlySalesData.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
          console.log(`Aylık satış: ${monthlySalesTotal} TL, ${monthlyTransactions} işlem`);
        }
      } catch (dataError) {
        console.error('Satış verileri çekilirken hata:', dataError);
      }
      
      // Verileri state'e kaydet
      setSalesData({
        dailySales: dailySalesTotal,
        weeklySales: weeklySalesTotal,
        monthlySales: monthlySalesTotal,
        totalProducts: 0, // Ürün sayısı ayrı olarak çekilecek
        hourlyTransactions: hourlyTransactions,
        hourlySalesAmount: hourlySalesTotal,
        dailyTransactions: dailyTransactions,
        weeklyTransactions: weeklyTransactions,
        monthlyTransactions: monthlyTransactions
      });
      
      // Toplam ürün sayısını getir
      let totalProducts = 0;
      try {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id', { count: 'exact' });
          
        if (!productsError) {
          totalProducts = productsData.length;
          // Ürün sayısını güncelle
          setSalesData(prev => ({ ...prev, totalProducts }));
        }
      } catch (productsError) {
        console.error('Ürün sayısı alınırken hata:', productsError);
      }
      
      // Son 7 günün satışlarını getir (grafik için)
      try {
        const last7Days = [];
        const salesByDay = [];
        
        // Son 7 günün tarihlerini oluştur
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          last7Days.push(`${day}/${month}`);
          
          // Her gün için başlangıç değeri 0
          salesByDay.push(0);
        }
        
        // Son 7 günün satışlarını getir
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        
        const { data: last7DaysSales, error: salesError } = await supabase
          .from('sales')
          .select('sale_time, total_amount')
          .eq('branch_id', selectedBranchId)
          .gte('sale_time', sevenDaysAgo.toISOString())
          .order('sale_time');
        
        if (!salesError && last7DaysSales) {
          // Her satışı ilgili güne ekle
          last7DaysSales.forEach(sale => {
            const saleDate = new Date(sale.sale_time);
            const day = saleDate.getDate();
            const month = saleDate.getMonth() + 1;
            const dateStr = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
            
            const dayIndex = last7Days.indexOf(dateStr);
            if (dayIndex !== -1) {
              salesByDay[dayIndex] += parseFloat(sale.total_amount);
            }
          });
          
          setSalesChartData({
            labels: last7Days,
            datasets: [
              {
                data: salesByDay,
                color: (opacity = 1) => `rgba(0, 102, 255, ${opacity})`,
                strokeWidth: 2
              }
            ]
          });
        }
      } catch (chartError) {
        console.error('Grafik verileri hazırlanırken hata:', chartError);
      }
      
      // En çok satılan ürünleri getir
      try {
        // Önce şubeye ait satışları al
        const { data: branchSales, error: branchSalesError } = await supabase
          .from('sales')
          .select('id')
          .eq('branch_id', selectedBranchId)
          .gte('sale_time', startOfDay.toISOString());
          
        if (!branchSalesError && branchSales && branchSales.length > 0) {
          // Satış ID'lerini al
          const saleIds = branchSales.map(sale => sale.id);
          
          // Bu satışlara ait ürünleri getir
          const { data: topProductsData, error: topProductsError } = await supabase
            .from('sale_items')
            .select(`
              id,
              product_id,
              quantity,
              products:product_id (name)
            `)
            .in('sale_id', saleIds);
            
          if (!topProductsError && topProductsData && topProductsData.length > 0) {
            // Ürünleri grupla ve sayılarını hesapla
            const productCounts = {};
            topProductsData.forEach(item => {
              const productId = item.product_id;
              const productName = item.products?.name || 'Bilinmeyen Ürün';
              const quantity = item.quantity || 1;
              
              if (!productCounts[productId]) {
                productCounts[productId] = {
                  id: productId,
                  name: productName,
                  count: 0
                };
              }
              
              productCounts[productId].count += quantity;
            });
            
            // En çok satılan 3 ürünü al
            const topProducts = Object.values(productCounts)
              .sort((a, b) => b.count - a.count)
              .slice(0, 3);
              
            setTopProducts(topProducts);
            console.log('En çok satılan ürünler:', topProducts);
          } else {
            setTopProducts([]);
          }
        } else {
          setTopProducts([]);
        }
      } catch (topProductsError) {
        console.error('En çok satılan ürünler alınırken hata:', topProductsError);
        setTopProducts([]);
      }
      
      // Düşük stoklu ürünleri getir
      try {
        const { data: stockData, error: stockError } = await supabase
          .from('branch_ingredient_stock')
          .select(`
            id,
            branch_id,
            ingredient_id,
            stock_level,
            low_stock_threshold,
            ingredients:ingredient_id (name)
          `)
          .eq('branch_id', selectedBranchId)
          .lt('stock_level', 10);
          
        if (stockError) throw stockError;
        
        if (stockData && stockData.length > 0) {
          setLowStockItems(stockData);
          console.log('Düşük stoklu malzemeler:', stockData.length);
        } else {
          setLowStockItems([]);
          console.log('Düşük stoklu malzeme bulunamadı');
        }
      } catch (stockError) {
        console.error('Stok verileri alınırken hata:', stockError);
        setLowStockItems([]);
      }
      
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Satış verileri yüklenirken hata:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBranchId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchDashboardData();
      return () => {
        // Optional: Cleanup if needed when screen loses focus
        // console.log('Dashboard screen unfocused');
      };
    }, [fetchDashboardData])
  );
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Şube değiştirme işlevi
  const handleBranchChange = (branchId, branchName) => {
    setSelectedBranchId(branchId);
    setSelectedBranch(branchName);
    setBranchDropdownVisible(false);
    if (isMobile) {
      toggleMenu();
    }
  };

  const toggleBranchDropdown = () => {
    setBranchDropdownVisible(!branchDropdownVisible);
  };

  const renderDashboardContent = () => {
    if (loading && !refreshing) {
      return (
        <ScrollView style={[styles.content, { paddingTop: 10 }]}>
          <View style={styles.headerBanner}>
            <Text style={styles.headerBannerTitle}>Yönetim Paneli</Text>
            <Text style={styles.headerBannerSubtitle}>Şube: {selectedBranch}</Text>
          </View>
          
          {/* Satış İstatistikleri */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Satış İstatistikleri</Text>
            
            <View style={styles.cardContainer}>
              {/* <View style={[styles.detailCard, { backgroundColor: '#00BFFF' }]}>
                <Ionicons name="time-outline" size={24} color="white" />
                <Text style={styles.detailCardTitle}>Son 1 Saat Satışları</Text>
                <Text style={styles.detailCardSubtitle}>{salesData.hourlyTransactions} Satış</Text>
                <Text style={styles.detailCardValue}>{formatCurrency(salesData.hourlySalesAmount)}</Text>
              </View> */}
              
              <View style={[styles.detailCard, { backgroundColor: '#00A86B' }]}>
                <Ionicons name="today-outline" size={24} color="white" />
                <Text style={styles.detailCardTitle}>Bugünkü Satışlar</Text>
                <Text style={styles.detailCardSubtitle}>{salesData.dailyTransactions} Satış</Text>
                <Text style={styles.detailCardValue}>{formatCurrency(salesData.dailySales)}</Text>
              </View>
              
              <View style={[styles.detailCard, { backgroundColor: '#FF8C00' }]}>
                <Ionicons name="calendar-outline" size={24} color="white" />
                <Text style={styles.detailCardTitle}>Bu Haftalık Satışlar</Text>
                <Text style={styles.detailCardSubtitle}>{salesData.weeklyTransactions} Satış</Text>
                <Text style={styles.detailCardValue}>{formatCurrency(salesData.weeklySales)}</Text>
              </View>
              
              <View style={[styles.detailCard, { backgroundColor: '#9370DB' }]}>
                <Ionicons name="stats-chart-outline" size={24} color="white" />
                <Text style={styles.detailCardTitle}>Bu Aylık Satışlar</Text>
                <Text style={styles.detailCardSubtitle}>{salesData.monthlyTransactions} Satış</Text>
                <Text style={styles.detailCardValue}>{formatCurrency(salesData.monthlySales)}</Text>
              </View>
            </View>
          </View>
          
          {/* Şube Analizleri */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Şube Analizleri</Text>
            
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>Satış Trendi (Son 7 Gün)</Text>
              {salesChartData.labels.length > 0 && (
                <View style={styles.simpleChartContainer}>
                  <View style={styles.chartLabels}>
                    {salesChartData.labels.map((label, index) => (
                      <Text key={index} style={styles.chartLabel}>{label}</Text>
                    ))}
                  </View>
                  <View style={styles.chartBars}>
                    {salesChartData.datasets[0].data.map((value, index) => {
                      const maxValue = Math.max(...salesChartData.datasets[0].data);
                      const height = maxValue > 0 ? (value / maxValue) * 150 : 0;
                      return (
                        <View key={index} style={styles.chartBarContainer}>
                          <View style={[styles.chartBar, { height }]}>
                            {height > 0 && (
                              <Text style={styles.chartBarValue}>
                                {value > 999 ? `${(value/1000).toFixed(1)}K` : value}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
            
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>Bugünün En Çok Satılanları</Text>
              {topProducts.length > 0 ? (
                <>
                  {topProducts.map((product, index) => (
                    <View key={product.id} style={styles.popularItem}>
                      <Text style={styles.itemRank}>{index + 1}.</Text>
                      <Text style={styles.itemName}>{product.name}</Text>
                      <Text style={styles.itemCount}>{product.count} adet</Text>
                    </View>
                  ))}
                  
                  {/* Çubuk grafik gösterimi */}
                  <View style={styles.simpleBarChart}>
                    {topProducts.map((product, index) => {
                      const maxCount = Math.max(...topProducts.map(p => p.count));
                      const barWidth = maxCount > 0 ? (product.count / maxCount) * 100 : 0;
                      
                      return (
                        <View key={product.id} style={styles.barChartRow}>
                          <Text style={styles.barChartLabel} numberOfLines={1} ellipsizeMode="tail">
                            {product.name}
                          </Text>
                          <View style={styles.barChartBarContainer}>
                            <View style={[styles.barChartBar, { width: `${barWidth}%` }]}>
                              <Text style={styles.barChartBarValue}>{product.count}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text style={styles.noItems}>Bugün için satış verisi bulunmuyor.</Text>
              )}
            </View>
            
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>Düşük Stok Uyarısı</Text>
              {lowStockItems.length > 0 ? (
                lowStockItems.map((item) => (
                  <View key={item.id} style={styles.popularItem}>
                    <MaterialIcons name="warning" size={18} color="#f44336" />
                    <Text style={styles.itemName}>{item.ingredients?.name || 'İsimsiz malzeme'}</Text>
                    <Text style={styles.itemCount}>{item.stock_level} adet kaldı</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noItems}>Düşük stoklu ürün bulunmamaktadır.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      );
    }
    
    return (
      <ScrollView 
        style={[styles.content, { paddingTop: 10 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1e3a8a"]}
            tintColor="#1e3a8a"
          />
        }
      >
        <View style={styles.headerBanner}>
          <Text style={styles.headerBannerTitle}>Yönetim Paneli</Text>
          <Text style={styles.headerBannerSubtitle}>Şube: {selectedBranch}</Text>
        </View>
        
        {/* Satış İstatistikleri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Satış İstatistikleri</Text>
          
          <View style={styles.cardContainer}>
            {/* <View style={[styles.detailCard, { backgroundColor: '#00BFFF' }]}>
              <Ionicons name="time-outline" size={24} color="white" />
              <Text style={styles.detailCardTitle}>Son 1 Saat Satışları</Text>
              <Text style={styles.detailCardSubtitle}>{salesData.hourlyTransactions} Satış</Text>
              <Text style={styles.detailCardValue}>{formatCurrency(salesData.hourlySalesAmount)}</Text>
            </View> */}
            
            <View style={[styles.detailCard, { backgroundColor: '#00A86B' }]}>
              <Ionicons name="today-outline" size={24} color="white" />
              <Text style={styles.detailCardTitle}>Bugünkü Satışlar</Text>
              <Text style={styles.detailCardSubtitle}>{salesData.dailyTransactions} Satış</Text>
              <Text style={styles.detailCardValue}>{formatCurrency(salesData.dailySales)}</Text>
            </View>
            
            <View style={[styles.detailCard, { backgroundColor: '#FF8C00' }]}>
              <Ionicons name="calendar-outline" size={24} color="white" />
              <Text style={styles.detailCardTitle}>Bu Haftalık Satışlar</Text>
              <Text style={styles.detailCardSubtitle}>{salesData.weeklyTransactions} Satış</Text>
              <Text style={styles.detailCardValue}>{formatCurrency(salesData.weeklySales)}</Text>
            </View>
            
            <View style={[styles.detailCard, { backgroundColor: '#9370DB' }]}>
              <Ionicons name="stats-chart-outline" size={24} color="white" />
              <Text style={styles.detailCardTitle}>Bu Aylık Satışlar</Text>
              <Text style={styles.detailCardSubtitle}>{salesData.monthlyTransactions} Satış</Text>
              <Text style={styles.detailCardValue}>{formatCurrency(salesData.monthlySales)}</Text>
            </View>
          </View>
        </View>
        
        {/* Şube Analizleri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Şube Analizleri</Text>
          
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsTitle}>Satış Trendi (Son 7 Gün)</Text>
            {salesChartData.labels.length > 0 && (
              <View style={styles.simpleChartContainer}>
                <View style={styles.chartLabels}>
                  {salesChartData.labels.map((label, index) => (
                    <Text key={index} style={styles.chartLabel}>{label}</Text>
                  ))}
                </View>
                <View style={styles.chartBars}>
                  {salesChartData.datasets[0].data.map((value, index) => {
                    const maxValue = Math.max(...salesChartData.datasets[0].data);
                    const height = maxValue > 0 ? (value / maxValue) * 150 : 0;
                    return (
                      <View key={index} style={styles.chartBarContainer}>
                        <View style={[styles.chartBar, { height }]}>
                          {height > 0 && (
                            <Text style={styles.chartBarValue}>
                              {value > 999 ? `${(value/1000).toFixed(1)}K` : value}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
          
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsTitle}>Bugünün En Çok Satılanları</Text>
            {topProducts.length > 0 ? (
              <>
                {topProducts.map((product, index) => (
                  <View key={product.id} style={styles.popularItem}>
                    <Text style={styles.itemRank}>{index + 1}.</Text>
                    <Text style={styles.itemName}>{product.name}</Text>
                    <Text style={styles.itemCount}>{product.count} adet</Text>
                  </View>
                ))}
                
                {/* Çubuk grafik gösterimi */}
                <View style={styles.simpleBarChart}>
                  {topProducts.map((product, index) => {
                    const maxCount = Math.max(...topProducts.map(p => p.count));
                    const barWidth = maxCount > 0 ? (product.count / maxCount) * 100 : 0;
                    
                    return (
                      <View key={product.id} style={styles.barChartRow}>
                        <Text style={styles.barChartLabel} numberOfLines={1} ellipsizeMode="tail">
                          {product.name}
                        </Text>
                        <View style={styles.barChartBarContainer}>
                          <View style={[styles.barChartBar, { width: `${barWidth}%` }]}>
                            <Text style={styles.barChartBarValue}>{product.count}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={styles.noItems}>Bugün için satış verisi bulunmuyor.</Text>
            )}
          </View>
          
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsTitle}>Düşük Stok Uyarısı</Text>
            {lowStockItems.length > 0 ? (
              lowStockItems.map((item) => (
                <View key={item.id} style={styles.popularItem}>
                  <MaterialIcons name="warning" size={18} color="#f44336" />
                  <Text style={styles.itemName}>{item.ingredients?.name || 'İsimsiz malzeme'}</Text>
                  <Text style={styles.itemCount}>{item.stock_level} adet kaldı</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noItems}>Düşük stoklu ürün bulunmamaktadır.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  // Ana içerik render fonksiyonu
  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return renderDashboardContent();
      case 'pos':
        return (
          <View style={{ flex: 1 }}>
            <POSScreen branchId={selectedBranchId} />
          </View>
        );
      case 'sales':
        return (
          <View style={{ flex: 1 }}>
            <SalesScreen />
          </View>
        );
      case 'categories':
        return (
          <View style={{ flex: 1 }}>
            <CategoriesScreen branchId={selectedBranchId} />
          </View>
        );
      case 'products':
        return (
          <View style={{ flex: 1 }}>
            <ProductsScreen />
          </View>
        );
      case 'ingredients':
        return (
          <View style={{ flex: 1 }}>
            <IngredientsScreen branchId={selectedBranchId} />
          </View>
        );
      case 'branches':
        return (
          <View style={{ flex: 1 }}>
            <BranchesScreen />
          </View>
        );
      case 'users':
        return (
          <View style={{ flex: 1 }}>
            <UsersScreen activeBranchId={selectedBranchId} />
          </View>
        );
      case 'payments':
        return (
          <View style={{ flex: 1 }}>
            <PaymentsScreen />
          </View>
        );
      case 'reports':
        return (
          <View style={{ flex: 1 }}>
            <ReportsScreen />
          </View>
        );
      case 'profile':
        return (
          <View style={{ flex: 1 }}>
            <ProfileScreen />
          </View>
        );
      default:
        return renderDashboardContent();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusBarPadding} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.menuButton} onPress={toggleMenu}>
            <Ionicons name={menuVisible ? "menu-outline" : "menu"} size={28} color="#333" />
          </TouchableOpacity>
          <Image 
            source={PLACEHOLDER_LOGO}
            style={styles.logo}
          />
          <MaterialCommunityIcons name="coffee-outline" size={24} color="#333" style={{ marginLeft: 10 }} />
          <Text style={styles.headerTitle}>Old Town Coffee</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={{position: 'relative'}}>
            <TouchableOpacity style={styles.userButton} onPress={toggleProfileMenu}>
              <Ionicons name="person-circle-outline" size={28} color="#333" />
            </TouchableOpacity>
            
            {profileMenuVisible && (
              <View style={styles.profileMenu}>
                <TouchableOpacity 
                  style={styles.profileMenuItem}
                  onPress={() => {
                    // Profil düzenleme ekranına yönlendir
                    setProfileMenuVisible(false);
                    setActivePage('profile');
                  }}
                >
                  <Ionicons name="person-outline" size={20} color="#333" />
                  <Text style={styles.profileMenuText}>Profil Düzenle</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.profileMenuItem}
                  onPress={() => supabase.auth.signOut()}
                >
                  <Ionicons name="log-out-outline" size={20} color="#d32f2f" />
                  <Text style={[styles.profileMenuText, {color: '#d32f2f'}]}>Çıkış Yap</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
      
      <View style={styles.mainContainer}>
        {/* Sol Menü - Animasyonlu */}
        <Animated.View style={[
          styles.sidebar, 
          { 
            transform: [{ translateX: slideAnim }],
            position: isMobile ? 'absolute' : 'relative',
            zIndex: 1000,
            height: '100%',
          }
        ]}>
          
          {/* Logo */}
          <View style={styles.sidebarLogoContainer}>
            <Image 
              source={SIDEBAR_LOGO}
              style={styles.sidebarLogo}
            />
            <Text style={styles.sidebarLogoText}>Old Town Coffee</Text>
          </View>
          
          {/* Gösterge Paneli linki */}
          <TouchableOpacity 
            style={[styles.menuItem, activePage === 'dashboard' && styles.activeMenuItem]}
            onPress={() => {
              setActivePage('dashboard');
              isMobile && toggleMenu();
            }}
          >
            <Ionicons name="grid-outline" size={20} color={activePage === 'dashboard' ? "#fff" : "#333"} />
            <Text style={[styles.menuText, activePage === 'dashboard' && styles.activeMenuText]}>Gösterge Paneli</Text>
          </TouchableOpacity>
          
          {/* Şube Seçici Dropdown */}
          <View style={styles.branchSelectorContainer}>
            <TouchableOpacity 
              style={styles.branchDropdownButton}
              onPress={toggleBranchDropdown}
            >
              <MaterialIcons name="store" size={16} color="#fff" style={{marginRight: 8}} />
              <Text style={styles.branchDropdownText}>{selectedBranch}</Text>
              <MaterialIcons 
                name={branchDropdownVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
            
            {branchDropdownVisible && (
              <View style={styles.branchDropdownMenu}>
                {branches.map(branch => (
                  <TouchableOpacity 
                    key={branch.id}
                    style={[
                      styles.branchDropdownItem, 
                      selectedBranchId === branch.id && styles.branchDropdownItemSelected
                    ]}
                    onPress={() => handleBranchChange(branch.id, branch.name)}
                  >
                    <MaterialIcons 
                      name="store" 
                      size={16} 
                      color={selectedBranchId === branch.id ? "#FF6B00" : "#333"} 
                      style={{marginRight: 8}}
                    />
                    <Text style={[
                      styles.branchDropdownItemText,
                      selectedBranchId === branch.id && styles.branchDropdownItemTextSelected
                    ]}>
                      {branch.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>SATIŞ İŞLEMLERİ</Text>
            
            <TouchableOpacity 
              style={[styles.menuItem, activePage === 'pos' && styles.activeMenuItem]}
              onPress={() => {
                setActivePage('pos');
                isMobile && toggleMenu();
              }}
            >
              <Ionicons name="card-outline" size={20} color={activePage === 'pos' ? "#fff" : "#333"} />
              <Text style={[styles.menuText, activePage === 'pos' && styles.activeMenuText]}>POS Ekranı</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, activePage === 'sales' && styles.activeMenuItem]}
              onPress={() => {
                setActivePage('sales');
                isMobile && toggleMenu();
              }}
            >
              <Ionicons name="cart-outline" size={20} color={activePage === 'sales' ? "#fff" : "#333"} />
              <Text style={[styles.menuText, activePage === 'sales' && styles.activeMenuText]}>Satışlar</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>ÜRÜN İŞLEMLERİ</Text>
            
            <TouchableOpacity 
              style={[styles.menuItem, activePage === 'categories' && styles.activeMenuItem]}
              onPress={() => {
                setActivePage('categories');
                isMobile && toggleMenu();
              }}
            >
              <MaterialIcons name="category" size={20} color={activePage === 'categories' ? "#fff" : "#333"} />
              <Text style={[styles.menuText, activePage === 'categories' && styles.activeMenuText]}>Kategoriler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, activePage === 'products' && styles.activeMenuItem]}
              onPress={() => {
                setActivePage('products');
                isMobile && toggleMenu();
              }}
            >
              <MaterialCommunityIcons name="coffee" size={20} color={activePage === 'products' ? "#fff" : "#333"} />
              <Text style={[styles.menuText, activePage === 'products' && styles.activeMenuText]}>Ürünler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, activePage === 'ingredients' && styles.activeMenuItem]}
              onPress={() => {
                setActivePage('ingredients');
                isMobile && toggleMenu();
              }}
            >
              <MaterialCommunityIcons name="food-variant" size={20} color={activePage === 'ingredients' ? "#fff" : "#333"} />
              <Text style={[styles.menuText, activePage === 'ingredients' && styles.activeMenuText]}>Malzemeler</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>YÖNETİMSEL İŞLEMLER</Text>
            
            <TouchableOpacity 
              style={[styles.menuItem, activePage === 'branches' && styles.activeMenuItem]}
              onPress={() => {
                setActivePage('branches');
                isMobile && toggleMenu();
              }}
            >
              <MaterialIcons name="store" size={20} color={activePage === 'branches' ? "#fff" : "#333"} />
              <Text style={[styles.menuText, activePage === 'branches' && styles.activeMenuText]}>Şubeler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, activePage === 'users' && styles.activeMenuItem]}
              onPress={() => {
                setActivePage('users');
                isMobile && toggleMenu();
              }}
            >
              <Ionicons name="people-outline" size={20} color={activePage === 'users' ? "#fff" : "#333"} />
              <Text style={[styles.menuText, activePage === 'users' && styles.activeMenuText]}>Kullanıcılar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, activePage === 'payments' && styles.activeMenuItem]}
              onPress={() => {
                setActivePage('payments');
                isMobile && toggleMenu();
              }}
            >
              <MaterialIcons name="payment" size={20} color={activePage === 'payments' ? "#fff" : "#333"} />
              <Text style={[styles.menuText, activePage === 'payments' && styles.activeMenuText]}>Ödeme Yöntemleri</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, activePage === 'reports' && styles.activeMenuItem]}
              onPress={() => {
                setActivePage('reports');
                isMobile && toggleMenu();
              }}
            >
              <Ionicons name="bar-chart-outline" size={20} color={activePage === 'reports' ? "#fff" : "#333"} />
              <Text style={[styles.menuText, activePage === 'reports' && styles.activeMenuText]}>Raporlar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* Overlay for closing menu when clicked outside on mobile */}
        {isMobile && menuVisible && (
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={0.5}
            onPress={toggleMenu}
          />
        )}
        
        {/* Ana İçerik */}
        <View style={styles.mainContent}>
          {renderContent()}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'ios' ? 5 : 0,
    marginTop: Platform.OS === 'ios' ? 20 : 10,
  },
  statusBarPadding: {
    height: Platform.OS === 'ios' ? 40 : 35,
    backgroundColor: '#1e3a8a',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    marginRight: 10,
    padding: 5,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  userButton: {
    padding: 5,
    marginLeft: 10,
  },
  logoutButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  logoutHeaderText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
    marginTop: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  sidebar: {
    width: 250,
    backgroundColor: '#f0f0f0',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 15,
  },
  branchList: {
    maxHeight: 150,
    marginBottom: 10,
    marginTop: 8,
    paddingRight: 5,
  },
  branchSelector: {
    backgroundColor: '#e0e0e0',
    padding: 12,
    borderRadius: 5,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1e3a8a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  branchText: {
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  activeBranchText: {
    color: '#fff',
  },
  menuSection: {
    marginBottom: 8,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 5,
    marginTop: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 5,
    marginBottom: 3,
  },
  activeMenuItem: {
    backgroundColor: '#1e3a8a',
  },
  menuText: {
    marginLeft: 10,
    color: '#333',
  },
  activeMenuText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    paddingTop: 0,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 10,
  },
  card: {
    width: isMobile ? '48%' : '24%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    minHeight: 110,
  },
  cardTitle: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
    fontWeight: '500',
  },
  cardValue: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
  },
  section: {
    marginBottom: 25,
    marginTop: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  detailCard: {
    width: isMobile ? '100%' : '32%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    minHeight: 120,
  },
  detailCardTitle: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
  },
  detailCardSubtitle: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
    opacity: 0.8,
  },
  detailCardValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
  },
  analyticsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  simpleChartContainer: {
    marginVertical: 15,
    paddingHorizontal: 10,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chartLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    width: 40,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  chartBar: {
    width: 30,
    backgroundColor: '#0066FF',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  chartBarValue: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  popularItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemRank: {
    width: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  itemName: {
    flex: 1,
    color: '#333',
  },
  itemCount: {
    color: '#888',
    fontSize: 14,
  },
  noItems: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  headerBanner: {
    backgroundColor: '#1e3a8a',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerBannerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  headerBannerSubtitle: {
    fontSize: 14,
    color: 'white',
  },
  profileMenu: {
    position: 'absolute',
    top: 45,
    right: 0,
    width: 180,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileMenuText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  sidebarLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sidebarLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  sidebarLogoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  branchSelectorContainer: {
    marginBottom: 15,
    position: 'relative',
    zIndex: 100,
  },
  branchDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 5,
    backgroundColor: '#FF6B00',
    borderWidth: 1,
    borderColor: '#E06000',
  },
  branchDropdownText: {
    flex: 1,
    color: '#fff',
    fontWeight: 'bold',
  },
  branchDropdownMenu: {
    marginTop: 5,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 200,
  },
  branchDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  branchDropdownItemSelected: {
    backgroundColor: '#FFF4ED',
  },
  branchDropdownItemText: {
    color: '#333',
    fontWeight: 'bold',
  },
  branchDropdownItemTextSelected: {
    color: '#FF6B00',
  },
  simpleBarChart: {
    marginTop: 20,
    marginBottom: 10,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  barChartLabel: {
    width: 100,
    fontSize: 12,
    color: '#333',
    marginRight: 10,
  },
  barChartBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  barChartBar: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  barChartBarValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 