import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables yerine doğrudan değerleri kullanalım
// Bu değerleri gerçek uygulamada .env dosyasından almalısınız
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Add this after setting supabaseUrl and supabaseAnonKey
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Check environment variables.");
  // Ensure Alert is imported if not already. Assuming it's a React Native project, Alert should be available.
  // For this to work, you might need: import { Alert } from 'react-native'; at the top of the file.
  // However, to keep this edit minimal, I'll rely on Alert being globally available or handled by your bundler.
  // If this edit causes a new error about Alert not being defined, we'll need to add the import.
  alert("Configuration Error: Supabase URL or Anon Key is missing. App will not work correctly.");
  // Consider throwing an error here to halt execution if Supabase is critical for app start
  // throw new Error("Supabase configuration is missing.");
}

// AsyncStorage kullanarak kalıcı oturum yapılandırması
const customStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Global hata yakalama için listenerler
  global: {
    fetch: (...args) => fetch(...args),
  },
}); 