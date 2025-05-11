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

const UsersScreen = ({ activeBranchId }) => {
  // State tanımlamaları
  const [users, setUsers] = useState([]);
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
    full_name: '',
    email: '',
    role_id: 2,
    assigned_branch_id: '',
  });
  
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  });

  const flatListRef = useRef(null);

  const [branches, setBranches] = useState([]);

  // Kullanıcıları getir
  const fetchUsers = async () => {
    if (!activeBranchId) { // If no active branch, show no users and clear counts
      setUsers([]);
      setTotalCount(0);
      setTotalPages(0);
      setLoading(false);
      setRefreshing(false);
      // Optionally, you could set a message here to inform the user to select a branch.
      // For now, it will just show the "Henüz kullanıcı eklenmemiş" or similar message.
      return;
    }

    try {
      setLoading(true);
      
      let countQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_branch_id', activeBranchId); // Filter by active branch

      if (searchQuery) { // Apply search to count if needed (consistency)
        countQuery = countQuery.or(`full_name.ilike.%${searchQuery}%`);
      }

      const { count, error: countError } = await countQuery;
        
      if (countError) throw countError;
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / pageSize));
      
      let query = supabase
        .from('profiles')
        .select('id, full_name, role_id, assigned_branch_id, created_at, updated_at') // Removed is_active
        .eq('assigned_branch_id', activeBranchId); // Filter by active branch
        
      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%`);
      }
      
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) { // Log the specific Supabase error
        console.error('Supabase error fetching users:', error);
        throw error; // Re-throw to be caught by the generic catch block
      }
      setUsers(data || []);
    } catch (error) {
      // The console.error from the specific Supabase error above will provide more detail
      Alert.alert('Hata', 'Kullanıcılar yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Sayfa değiştiğinde veya filtre uygulandığında kullanıcıları tekrar getir
  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, searchQuery, activeBranchId]); // Added activeBranchId to dependencies

  // Sayfayı yenile
  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Form alanlarını sıfırla
  const resetForm = () => {
    setFormData({
      id: null,
      full_name: '',
      email: '',
      role_id: 2, // Default role, ensure this ID exists in your roles table
      assigned_branch_id: activeBranchId || '', // Default to active branch
    });
    
    setPasswordData({
      password: '',
      confirmPassword: '',
    });
  };

  // Düzenleme modunu başlat
  const startEdit = (item) => {
    setFormData({
      id: item.id,
      full_name: item.full_name || '',
      email: item.email || '', // Populate email for edit mode (display only)
      role_id: item.role_id || 2,
      assigned_branch_id: item.assigned_branch_id || activeBranchId || '',
    });
    setPasswordData({ password: '', confirmPassword: '' }); // Clear password fields for edit mode
    setFormMode('edit');
    setModalVisible(true);
  };

  // Kullanıcı ekle veya güncelle
  const handleSaveUser = async () => {
    // Form doğrulama
    if (!formData.full_name || !formData.full_name.trim()) {
      Alert.alert('Hata', 'Ad Soyad alanı boş olamaz.');
      return;
    }

    if (!formData.email || !formData.email.trim()) {
        Alert.alert('Hata', 'Email alanı boş olamaz.');
        return;
    }
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
        Alert.alert('Hata', 'Geçerli bir email adresi girin.');
        return;
    }

    // Yeni kullanıcı oluşturulurken şifre kontrolü
    if (formMode === 'add') {
      if (!passwordData.password) {
        Alert.alert('Hata', 'Şifre alanı boş olamaz.');
        return;
      }
      
      if (passwordData.password.length < 6) {
        Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
        return;
      }
      
      if (passwordData.password !== passwordData.confirmPassword) {
        Alert.alert('Hata', 'Şifreler eşleşmiyor.');
        return;
      }
    }

    try {
      setLoading(true);
      
      if (formMode === 'add') {
        // Önce auth tablosuna kullanıcı ekle
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email.trim(), // Use trimmed email
          password: passwordData.password,
          options: {
            data: {
              // full_name can be stored in user_metadata if desired
              // but profiles table is the main source for other app data
              // For now, we'll rely on the profiles table update below for full_name
            }
          }
        });
        
        if (authError) throw authError;
        
        if (!authData.user) {
          throw new Error('Kullanıcı oluşturulamadı (auth).');
        }
        
        // Mevcut profili kontrol et
        const { data: existingProfile, error: fetchProfileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (fetchProfileError && fetchProfileError.code !== 'PGRST116') { // PGRST116: no rows found
          // Mevcut profil kontrol edilirken bir hata oluştu, auth kullanıcısını silmeyi dene
          console.error("Mevcut profil kontrol edilirken hata:", fetchProfileError);
          try {
            await supabase.functions.invoke('delete-auth-user-on-error', { body: { userId: authData.user.id } });
          } catch (e) { /* ignore cleanup error */ }
          throw new Error(`Mevcut profil kontrol edilirken hata: ${fetchProfileError.message}`);
        }

        if (existingProfile) {
          // Profil zaten mevcut, bu bir çakışma. Auth kullanıcısını silmeyi dene.
          console.warn(`Profil ID ${authData.user.id} için zaten mevcut. Auth kullanıcısı silinecek.`);
          try {
            await supabase.functions.invoke('delete-auth-user-on-error', { body: { userId: authData.user.id } });
          } catch (e) { /* ignore cleanup error */ }
          throw new Error('Profil zaten mevcut. Lütfen farklı bir email ile tekrar deneyin veya sistem yöneticisi ile iletişime geçin.');
        }
        
        // Profil bilgilerini kaydet
        const profileInsertData = {
          id: authData.user.id, // Ensure id is explicitly set
          full_name: formData.full_name.trim(),
          // email: formData.email.trim(), // Removed: Email will not be stored in profiles table directly
          role_id: formData.role_id,
          assigned_branch_id: formData.assigned_branch_id || null, // Ensure null if empty
          updated_at: new Date().toISOString(),
          // created_at will be set by default by Supabase
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .insert(profileInsertData); // Use insert for new profile
          
        if (profileError) {
            // If profile creation fails, attempt to delete the auth user to prevent orphaned auth users
            console.error("Error creating profile, attempting to delete auth user via Edge Function:", profileError);
            try {
              const { data: funcData, error: funcError } = await supabase.functions.invoke('delete-auth-user-on-error', {
                body: { userId: authData.user.id }
              });
              if (funcError) {
                console.error('Edge Function error while deleting auth user:', funcError.message);
                // Even if function fails, proceed to throw original profile error but note that cleanup might be incomplete
                throw new Error(`Profil oluşturulamadı: ${profileError.message}. Auth kullanıcısını silme denemesi başarısız oldu (fonksiyon hatası: ${funcError.message}).`);
              } else {
                console.log('Auth user deletion requested via Edge Function:', funcData);
                throw new Error(`Profil oluşturulamadı: ${profileError.message}. Auth kullanıcısı silindi (fonksiyon aracılığıyla).`);
              }
            } catch (invokeError) {
                console.error('Error invoking Edge Function for auth user deletion:', invokeError.message);
                throw new Error(`Profil oluşturulamadı: ${profileError.message}. Auth kullanıcısını silme denemesi başarısız oldu (çağrı hatası: ${invokeError.message}).`);
            }
        }
        
        Alert.alert('Başarılı', 'Kullanıcı başarıyla eklendi.');
      } else { // Edit mode
        // Mevcut kullanıcıyı güncelle (profiles table only)
        // Password changes are not handled here. Email is not editable in form.
        const profileUpdateData = {
            full_name: formData.full_name.trim(),
            // email: formData.email.trim(), // Email is not editable in form for now
            role_id: formData.role_id,
            assigned_branch_id: formData.assigned_branch_id || null, // Ensure null if empty
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('profiles')
          .update(profileUpdateData)
          .eq('id', formData.id);
          
        if (error) throw error;
        
        Alert.alert('Başarılı', 'Kullanıcı başarıyla güncellendi.');
      }
      
      setModalVisible(false);
      resetForm();
      fetchUsers();
      
    } catch (error) {
      console.error('Kullanıcı kaydedilirken hata:', error);
      Alert.alert('Hata', 'Kullanıcı kaydedilirken bir sorun oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Placeholder for deleting a user
  const handleDeleteUser = (item) => {
    Alert.alert(
      'Kullanıcı Sil',
      `"${item.full_name}" adlı kullanıcıyı silme işlemi henüz tanımlanmadı.`,
      [{ text: 'Tamam' }]
    );
    // We can implement actual deletion logic here later, 
    // similar to handleDeleteBranch with confirmation.
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

  // Kullanıcı satırı render fonksiyonu
  const renderUserItem = ({ item }) => (
    <View style={styles.tableRow}>
      <View style={[styles.tableCell, { flex: 1.5 }]}>
        <Text style={styles.cellText}>{item.full_name}</Text>
      </View>
      <View style={[styles.tableCell, { flex: 0.8 }]}>
        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role_id) }]}>
          <Text style={styles.roleBadgeText}>{getRoleLabel(item.role_id)}</Text>
        </View>
      </View>
      <View style={[styles.tableCell, { flex: 1, justifyContent: 'center' }]}>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => startEdit(item)}
          >
            <MaterialIcons name="edit" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deactivateButton]}
            onPress={() => handleDeleteUser(item)}
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
      <View style={[styles.tableHeaderCell, { flex: 1.5 }]}>
        <Text style={styles.tableHeaderText}>Ad Soyad</Text>
      </View>
      <View style={[styles.tableHeaderCell, { flex: 0.8 }]}>
        <Text style={styles.tableHeaderText}>Rol</Text>
      </View>
      <View style={[styles.tableHeaderCell, { flex: 1 }]}>
        <Text style={styles.tableHeaderText}>İşlemler</Text>
      </View>
    </View>
  );

  // Rol etiketi
  function getRoleLabel(role_id) {
    if (role_id === 1) return 'Yönetici';
    if (role_id === 2) return 'Kasiyer';
    if (role_id === 3) return 'Şube Müdürü';
    return 'Kullanıcı';
  }
  function getRoleColor(role_id) {
    if (role_id === 1) return '#3b5bdb'; // Yönetici - koyu mavi
    if (role_id === 2) return '#00b8d9'; // Kasiyer - koyu turkuaz
    if (role_id === 3) return '#43a047'; // Şube Müdürü - koyu yeşil
    return '#757575'; // Kullanıcı - koyu gri
  }
  // Şube etiketi
  function getBranchLabel(branchId) {
    if (!branchId) return 'Tüm Şubeler';
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : branchId;
  }
  function getBranchColor() {
    return '#00897b'; // Koyu yeşil-mavi
  }

  // Sayfalama kontrollerini render et
  const renderPaginationControls = () => (
    <View style={styles.paginationContainer}>
      <View style={styles.paginationInfo}>
        <Text style={styles.paginationText}>
          Toplam {totalCount} kullanıcı 
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

  useEffect(() => {
    async function fetchBranches() {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name');
      if (!error) setBranches(data || []);
    }
    fetchBranches();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kullanıcılar</Text>
        <View style={styles.headerActions}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Kullanıcı Ara..."
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
            <Text style={styles.addButtonText}>Yeni Kullanıcı Ekle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Kullanıcılar yükleniyor...</Text>
        </View>
      ) : (
        <>
          <View style={styles.tableContainer}>
            {renderTableHeader()}
            
            {users.length === 0 ? (
              <View style={styles.noDataContainer}>
                <Ionicons name="information-circle-outline" size={50} color="#888" />
                <Text style={styles.noDataText}>
                  {filterApplied 
                    ? "Aranan kriterlere uygun kullanıcı bulunamadı." 
                    : "Henüz kullanıcı eklenmemiş."}
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
                data={users}
                keyExtractor={(item) => item.id}
                renderItem={renderUserItem}
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

      {/* Kullanıcı Ekleme/Düzenleme Modal */}
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
              {formMode === 'add' ? 'Yeni Kullanıcı Ekle' : 'Kullanıcı Düzenle'}
            </Text>
            
            <ScrollView style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Ad Soyad</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.full_name}
                  onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                  placeholder="Ad Soyad"
                />
              </View>

              {/* Email Input */} 
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text.toLowerCase() })}
                  placeholder="Email adresi"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={formMode === 'add'} // Email only editable on add mode
                />
              </View>

              {formMode === 'add' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Şifre</Text>
                    <TextInput
                      style={styles.formInput}
                      value={passwordData.password}
                      onChangeText={(text) => setPasswordData({ ...passwordData, password: text })}
                      placeholder="Şifre (en az 6 karakter)"
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Şifre Tekrar</Text>
                    <TextInput
                      style={styles.formInput}
                      value={passwordData.confirmPassword}
                      onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                      placeholder="Şifreyi tekrar girin"
                      secureTextEntry
                    />
                  </View>
                </>
              )}
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Rol</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity 
                    style={[styles.radioButton, formData.role_id === 1 && styles.radioButtonSelected]}
                    onPress={() => setFormData({ ...formData, role_id: 1 })}
                  >
                    <View style={[styles.radioCircle, formData.role_id === 1 && styles.radioCircleSelected]} />
                    <Text style={styles.radioLabel}>Yönetici</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.radioButton, formData.role_id === 2 && styles.radioButtonSelected]}
                    onPress={() => setFormData({ ...formData, role_id: 2 })}
                  >
                    <View style={[styles.radioCircle, formData.role_id === 2 && styles.radioCircleSelected]} />
                    <Text style={styles.radioLabel}>Kasiyer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.radioButton, formData.role_id === 3 && styles.radioButtonSelected]}
                    onPress={() => setFormData({ ...formData, role_id: 3 })}
                  >
                    <View style={[styles.radioCircle, formData.role_id === 3 && styles.radioCircleSelected]} />
                    <Text style={styles.radioLabel}>Şube Müdürü</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Şube</Text>
                <View style={styles.radioGroup}>
                  {branches.map(branch => (
                    <TouchableOpacity
                      key={branch.id}
                      style={[styles.radioButton, formData.assigned_branch_id === branch.id && styles.radioButtonSelected]}
                      onPress={() => setFormData({ ...formData, assigned_branch_id: branch.id })}
                    >
                      <View style={[styles.radioCircle, formData.assigned_branch_id === branch.id && styles.radioCircleSelected]} />
                      <Text style={styles.radioLabel}>{branch.name}</Text>
                    </TouchableOpacity>
                  ))}
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
                onPress={handleSaveUser}
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
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#888',
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  radioButtonSelected: {
    borderColor: '#1e3a8a',
    backgroundColor: '#f0f4ff',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#777',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#1e3a8a',
    borderWidth: 6,
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
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
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    margin: 5,
    marginTop: 10,
  },
  paginationInfo: {
    flex: 0.8,
  },
  paginationText: {
    color: '#fff',
    fontSize: 12,
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  pageButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  pageIndicator: {
    paddingHorizontal: 10,
  },
  pageIndicatorText: {
    color: '#fff',
    fontSize: 12,
  },
  pageSizeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.2,
    justifyContent: 'flex-end',
  },
  pageSizeLabel: {
    color: '#fff',
    marginRight: 5,
    fontSize: 12,
  },
  pageSizeButton: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginLeft: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
  },
  activePageSizeButton: {
    backgroundColor: '#fff',
  },
  pageSizeButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  activePageSizeButtonText: {
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  roleBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  branchBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  branchBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default UsersScreen; 