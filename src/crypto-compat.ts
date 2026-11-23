// randomUUID requires HTTPS, but getRandomValues also works on LAN HTTP.
const browserCrypto = globalThis.crypto;

if (typeof browserCrypto?.randomUUID !== 'function') {
  if (typeof browserCrypto?.getRandomValues !== 'function') {
    throw new Error('当前浏览器不支持安全随机数，请使用新版 Chrome 或 Edge。');
  }

  Object.defineProperty(browserCrypto, 'randomUUID', {
    configurable: true,
    writable: true,
    value: () => {
      const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
      // RFC 9562: UUID version 4, IETF variant.
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },
  });
}
