import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';
import * as ImagePicker from 'expo-image-picker';

const ProfileScreen = () => {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Form değerlerini güncelleme
  const handleChange = (name, value) => {
    setForm(prevForm => ({
      ...prevForm,
      [name]: value
    }));
  };
  
  // Kullanıcı bilgilerini yükle
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        setLoading(true);
        
        // Mevcut kullanıcı bilgilerini al
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Profil verilerini getir
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (error) {
            console.error('Profil bilgileri alınamadı:', error);
          } else if (profileData) {
            setUserProfile(profileData);
            
            // Form verilerini doldur
            setForm({
              ...form,
              fullName: profileData.full_name || '',
              username: profileData.username || '',
              email: user.email || '',
              phone: profileData.phone || ''
            });
            
            // Profil resmi varsa yükle
            if (profileData.avatar_url) {
              setProfileImage(profileData.avatar_url);
            }
          }
        }
      } catch (error) {
        console.error('Kullanıcı bilgileri alınamadı:', error);
        Alert.alert('Hata', 'Profil bilgileri yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchUserProfile();
  }, []);
  
  // Profil fotoğrafı seçme
  const pickImage = async () => {
    try {
      // İzinleri kontrol et
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Kütüphaneye erişim izni gerekiyor.');
          return;
        }
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Resim yükleme başarılı - URI'yi geçici olarak göster
        setProfileImage(result.assets[0].uri);
        
        // Resmi Supabase'e yükle ve profili güncelle
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Resim seçme hatası:', error);
      Alert.alert('Hata', 'Resim yüklenirken bir sorun oluştu.');
    }
  };
  
  // Profil fotoğrafını Supabase'e yükleme
  const uploadProfileImage = async (uri) => {
    try {
      setUpdating(true);
      
      // Dosya adını hazırla
      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      // Dosyayı fetch ile almak için URI'dan blob oluştur
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Supabase storage'a yükle
      const { data, error } = await supabase.storage
        .from('profiles')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`
        });
      
      if (error) {
        throw error;
      }
      
      // Resmin public URL'ini al
      const { data: urlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);
      
      // Profil tablosunu güncelle
      const avatarUrl = urlData.publicUrl;
      await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
      
      // State'i güncelle
      setProfileImage(avatarUrl);
      Alert.alert('Başarılı', 'Profil resmi güncellendi.');
      
    } catch (error) {
      console.error('Resim yükleme hatası:', error);
      Alert.alert('Hata', 'Profil resmi güncellenirken bir sorun oluştu.');
    } finally {
      setUpdating(false);
    }
  };
  
  // Profil bilgilerini güncelleme
  const updateProfile = async () => {
    try {
      setUpdating(true);
      
      // Validasyon kontrolleri
      if (!form.fullName.trim()) {
        Alert.alert('Uyarı', 'İsim alanı boş olamaz.');
        return;
      }
      
      // Şifre değiştirilecekse kontroller
      if (form.newPassword) {
        if (!form.currentPassword) {
          Alert.alert('Uyarı', 'Mevcut şifrenizi girmelisiniz.');
          return;
        }
        
        if (form.newPassword.length < 6) {
          Alert.alert('Uyarı', 'Yeni şifre en az 6 karakter olmalıdır.');
          return;
        }
        
        if (form.newPassword !== form.confirmPassword) {
          Alert.alert('Uyarı', 'Yeni şifre ve onay şifresi eşleşmiyor.');
          return;
        }
        
        // Şifreyi değiştir
        const { error: passwordError } = await supabase.auth.updateUser({
          password: form.newPassword
        });
        
        if (passwordError) {
          Alert.alert('Hata', 'Şifre güncellenirken bir sorun oluştu: ' + passwordError.message);
          return;
        }
      }
      
      // Kullanıcı bilgilerini al
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı.');
        return;
      }
      
      // Profil bilgilerini güncelle
      const updates = {
        id: user.id,
        full_name: form.fullName,
        username: form.username,
        phone: form.phone,
        updated_at: new Date()
      };
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      
      if (error) {
        throw error;
      }
      
      // E-posta değiştirilecekse
      if (form.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: form.email
        });
        
        if (emailError) {
          Alert.alert('Uyarı', 'E-posta güncellenirken bir sorun oluştu: ' + emailError.message);
        } else {
          Alert.alert('Bilgi', 'E-posta adresiniz değiştirildi. Yeni adresinizi doğrulamak için e-postanızı kontrol edin.');
        }
      }
      
      // Şifre alanlarını temizle
      setForm(prevForm => ({
        ...prevForm,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      
      Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi.');
      
    } catch (error) {
      console.error('Profil güncelleme hatası:', error);
      Alert.alert('Hata', 'Profil güncellenirken bir sorun oluştu: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Profil bilgileri yükleniyor...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil Düzenle</Text>
      </View>
      
      {/* Profil Fotoğrafı */}
      <View style={styles.avatarContainer}>
        {profileImage ? (
          <Image 
            source={{ uri: profileImage }} 
            style={styles.avatar} 
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={60} color="#ccc" />
          </View>
        )}
        
        <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.changePhotoText}>Fotoğraf Değiştir</Text>
        </TouchableOpacity>
      </View>
      
      {/* Kişisel Bilgiler */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Ad Soyad</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.fullName}
              onChangeText={(text) => handleChange('fullName', text)}
              placeholder="Ad Soyad"
            />
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Kullanıcı Adı</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="at" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.username}
              onChangeText={(text) => handleChange('username', text)}
              placeholder="Kullanıcı Adı"
            />
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>E-posta</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(text) => handleChange('email', text)}
              placeholder="E-posta"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Telefon</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(text) => handleChange('phone', text)}
              placeholder="Telefon"
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>
      
      {/* Şifre Değiştirme */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Şifre Değiştir</Text>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Mevcut Şifre</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.currentPassword}
              onChangeText={(text) => handleChange('currentPassword', text)}
              placeholder="Mevcut Şifre"
              secureTextEntry
            />
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Yeni Şifre</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-open-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.newPassword}
              onChangeText={(text) => handleChange('newPassword', text)}
              placeholder="Yeni Şifre"
              secureTextEntry
            />
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Şifre Tekrar</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-open-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.confirmPassword}
              onChangeText={(text) => handleChange('confirmPassword', text)}
              placeholder="Şifre Tekrar"
              secureTextEntry
            />
          </View>
        </View>
      </View>
      
      {/* Güncelleme Butonu */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.updateButton}
          onPress={updateProfile}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.updateButtonText}>Profili Güncelle</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  avatarContainer: {
    alignItems: 'center',
    margin: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  changePhotoText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  section: {
    margin: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginLeft: 10,
    marginRight: 5,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    margin: 20,
  },
  updateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    padding: 15,
    borderRadius: 5,
  },
  buttonIcon: {
    marginRight: 10,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen; 