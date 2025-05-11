// Mock for Node's crypto module
// This provides the minimum functionality needed by ws

const crypto = {
  // Generate random bytes
  randomBytes: (size) => {
    const arr = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return {
      toString: (encoding) => {
        if (encoding === 'base64') {
          return btoa(String.fromCharCode.apply(null, arr));
        }
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    };
  },
  
  // Create hash object
  createHash: (algorithm) => {
    let data = '';
    return {
      update: (chunk) => {
        data += chunk;
        return this;
      },
      digest: (encoding) => {
        // Simple hashing mock - not cryptographically secure, just for mocking
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
          hash = ((hash << 5) - hash) + data.charCodeAt(i);
          hash |= 0; // Convert to 32bit integer
        }
        
        // Return a long hex string to simulate a hash
        const hashHex = Math.abs(hash).toString(16).padStart(32, '0');
        
        if (encoding === 'base64') {
          // Convert hex to base64
          const bytes = [];
          for (let i = 0; i < hashHex.length; i += 2) {
            bytes.push(parseInt(hashHex.substring(i, i + 2), 16));
          }
          return btoa(String.fromCharCode.apply(null, bytes));
        }
        
        return hashHex;
      }
    };
  }
};

module.exports = crypto; 