module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        alias: {
          'stream': 'stream-browserify',
          'events': 'events',
          'web-streams-polyfill': 'web-streams-polyfill',
          'http': 'react-native-http',
          'https': 'react-native-http',
          'crypto': './crypto-mock.js',
          'zlib': './zlib-mock.js'
        }
      }]
    ]
  };
}; 