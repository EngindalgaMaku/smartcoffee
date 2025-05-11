// Import all required polyfills
import 'react-native-polyfill-globals';
import 'stream-browserify';
import 'events';
import 'web-streams-polyfill';
import 'react-native-http';
import './crypto-mock';
import './buffer-mock';
import './zlib-mock';

// No need to call polyfill() as it's automatically applied
// in version 1.0.7 