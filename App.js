import './global';
import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { supabase } from './supabaseClient';
import LoginScreen from './screens/LoginScreen'; // We will create this
import DashboardScreen from './screens/DashboardScreen'; // We will create this
import { ActivityIndicator, View, StyleSheet, SafeAreaView } from 'react-native';
import Footer from './components/Footer';

const Stack = createStackNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Uygulama başlatıldığında mevcut oturumu kontrol et
    checkSession();

    // Oturum durumu değişikliklerini dinle
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(`Supabase auth event: ${event}`);
        setSession(newSession);
        setLoading(false);
      }
    );

    // Temizlik fonksiyonu
    return () => {
      if (authListener && typeof authListener.subscription?.unsubscribe === 'function') {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Mevcut oturumu kontrol et
  async function checkSession() {
    try {
      setLoading(true);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log("Mevcut oturum kontrolü:", currentSession ? "Oturum var" : "Oturum yok");
      setSession(currentSession);
    } catch (error) {
      console.error('Oturum kontrolünde hata:', error);
    } finally {
      setLoading(false);
    }
  }

  // Yükleme ekranı
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appContainer}>
        <NavigationContainer>
          <Stack.Navigator>
            {session && session.user ? (
              <Stack.Screen 
                name="Dashboard" 
                component={DashboardScreen} 
                options={{ headerShown: false }}
              />
            ) : (
              <Stack.Screen 
                name="Login" 
                component={LoginScreen} 
                options={{ headerShown: false }} 
              />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </View>
      <Footer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  appContainer: {
    flex: 1,
  },
}); 