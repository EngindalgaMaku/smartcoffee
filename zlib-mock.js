// Simple zlib mock for React Native
// This provides a no-op implementation of zlib functions used by ws

const zlib = {
  // Compression streams
  createDeflateRaw: (options) => {
    return createMockStream();
  },
  createInflateRaw: (options) => {
    return createMockStream();
  },
  
  // Constants mimicking Node.js zlib
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  Z_MEM_ERROR: -4,
  Z_BUF_ERROR: -5,
  Z_VERSION_ERROR: -6
};

// Create a mock stream that does nothing
function createMockStream() {
  const stream = {
    // Event handlers
    _events: {},
    
    // Methods
    write: (chunk, callback) => {
      if (typeof callback === 'function') setTimeout(callback, 0);
      return true;
    },
    
    flush: (kind, callback) => {
      if (typeof callback === 'function') setTimeout(callback, 0);
      return true;
    },
    
    close: (callback) => {
      if (typeof callback === 'function') setTimeout(callback, 0);
      return true;
    },
    
    // Event handling
    on: (event, listener) => {
      if (!stream._events[event]) stream._events[event] = [];
      stream._events[event].push(listener);
      return stream;
    },
    
    removeListener: (event, listener) => {
      if (stream._events[event]) {
        stream._events[event] = stream._events[event].filter(l => l !== listener);
      }
      return stream;
    },
    
    emit: (event, ...args) => {
      if (stream._events[event]) {
        for (const listener of stream._events[event]) {
          listener(...args);
        }
      }
      return true;
    },
    
    // Helper to simulate data event
    mockData: (data) => {
      stream.emit('data', Buffer.from(data));
      return stream;
    },
    
    // Helper to simulate end event
    mockEnd: () => {
      stream.emit('end');
      return stream;
    }
  };
  
  // Simulate data process in next tick
  setTimeout(() => {
    stream.emit('data', Buffer.from([]));
    stream.emit('end');
  }, 0);
  
  return stream;
}

module.exports = zlib; 