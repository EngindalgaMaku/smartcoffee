import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const Footer = () => {
  return (
    <View style={styles.footerContainer}>
      <Text style={styles.footerText}>
        Dalga Yazılım LTD. Tüm hakları saklıdır © 2025
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  footerContainer: {
    paddingHorizontal: 10,
    backgroundColor: '#f8f9fa', // Orijinal arka plan rengine geri dönüldü
    borderTopWidth: 1,
    borderTopColor: '#e7e7e7',
    alignItems: 'center',
    justifyContent: 'center',
    // paddingVertical yerine paddingTop ve paddingBottom'u ayrı ayrı yöneteceğiz
    paddingTop: Platform.OS === 'ios' ? 15 : 10,
    paddingBottom: Platform.OS === 'ios' ? 15 : 50, // Android için alt boşluğu 50'ye çıkardık
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d', // Orijinal metin rengine geri dönüldü
    textAlign: 'center',
  },
});

export default Footer; 