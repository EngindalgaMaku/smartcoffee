const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Assetler için konfigürasyon
config.resolver.assetExts.push('png', 'jpg', 'jpeg', 'gif');

config.resolver.extraNodeModules = {
  stream: require.resolve('stream-browserify'),
  events: require.resolve('events'),
  'web-streams-polyfill': require.resolve('web-streams-polyfill'),
  http: require.resolve('react-native-http'),
  https: require.resolve('react-native-http'),
  crypto: path.join(__dirname, 'crypto-mock.js'),
  zlib: path.join(__dirname, 'zlib-mock.js'),
  net: require.resolve('react-native-tcp-socket'),
  tls: require.resolve('react-native-tcp-socket'),
  url: require.resolve('react-native-url-polyfill')
};

module.exports = config; 