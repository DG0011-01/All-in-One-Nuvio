// Peachify — Nuvio Plugin
// Author: piratezoro9

const PROVIDER_NAME = "Peachify";

let PROXY_URL = "";

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

const SERVERS = [
  { label: "Iron",    url: "https://uwu.eat-peach.sbs/moviebox",  key: "iron" },
  { label: "Spider",  url: "https://usa.eat-peach.sbs/holly",     key: "spider" },
  { label: "Wolf",    url: "https://usa.eat-peach.sbs/air",       key: "wolf" },
  { label: "Backup",  url: "https://usa.eat-peach.sbs/multi",     key: "backup" },
];

const AES_KEY_HEX = "a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5b";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Origin": "https://peachify.top",
  "Referer": "https://peachify.top/",
};

// ── AES-256 primitives ──
// S-Box
const SBOX = [
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
];

const RSBOX = [
  0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
  0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
  0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
  0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
  0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
  0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
  0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x45,0x06,
  0xd0,0x2c,0x1e,0x8f,0xca,0x3f,0x0f,0x02,0xc1,0xaf,0xbd,0x03,0x01,0x13,0x8a,0x6b,
  0x3a,0x91,0x11,0x41,0x4f,0x67,0xdc,0xea,0x97,0xf2,0xcf,0xce,0xf0,0xb4,0xe6,0x73,
  0x96,0xac,0x74,0x22,0xe7,0xad,0x35,0x85,0xe2,0xf9,0x37,0xe8,0x1c,0x75,0xdf,0x6e,
  0x47,0xf1,0x1a,0x71,0x1d,0x29,0xc5,0x89,0x6f,0xb7,0x62,0x0e,0xaa,0x18,0xbe,0x1b,
  0xfc,0x56,0x3e,0x4b,0xc6,0xd2,0x79,0x20,0x9a,0xdb,0xc0,0xfe,0x78,0xcd,0x5a,0xf4,
  0x1f,0xdd,0xa8,0x33,0x88,0x07,0xc7,0x31,0xb1,0x12,0x10,0x59,0x27,0x80,0xec,0x5f,
  0x60,0x51,0x7f,0xa9,0x19,0xb5,0x4a,0x0d,0x2d,0xe5,0x7a,0x9f,0x93,0xc9,0x9c,0xef,
  0xa0,0xe0,0x3b,0x4d,0xae,0x2a,0xf5,0xb0,0xc8,0xeb,0xbb,0x3c,0x83,0x53,0x99,0x61,
  0x17,0x2b,0x04,0x7e,0xba,0x77,0xd6,0x26,0xe1,0x69,0x14,0x63,0x55,0x21,0x0c,0x7d
];

// Round constants
const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function xtime(a) { return ((a << 1) ^ (((a >> 7) & 1) * 0x1b)) & 0xff; }

// ── AES-256 Key Expansion ──
function aesKeyExpansion(keyBytes) {
  const w = [];
  for (let i = 0; i < 8; i++) {
    w[i] = (keyBytes[4*i] << 24) | (keyBytes[4*i+1] << 16) | (keyBytes[4*i+2] << 8) | keyBytes[4*i+3];
  }
  for (let i = 8; i < 60; i++) {
    let temp = w[i-1];
    if (i % 8 === 0) {
      temp = ((temp << 8) | (temp >>> 24)) >>> 0;
      const b0 = SBOX[(temp >>> 24) & 0xff];
      const b1 = SBOX[(temp >>> 16) & 0xff];
      const b2 = SBOX[(temp >>> 8) & 0xff];
      const b3 = SBOX[temp & 0xff];
      temp = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
      const rconVal = RCON[(i/8) - 1] << 24;
      temp = (temp ^ rconVal) >>> 0;
    } else if (i % 8 === 4) {
      const b0 = SBOX[(temp >>> 24) & 0xff];
      const b1 = SBOX[(temp >>> 16) & 0xff];
      const b2 = SBOX[(temp >>> 8) & 0xff];
      const b3 = SBOX[temp & 0xff];
      temp = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
    }
    w[i] = ((w[i-8] ^ temp) >>> 0);
  }
  const roundKeys = [];
  for (let r = 0; r < 15; r++) {
    const rk = new Uint8Array(16);
    for (let j = 0; j < 4; j++) {
      const word = w[r*4 + j];
      rk[4*j]   = (word >>> 24) & 0xff;
      rk[4*j+1] = (word >>> 16) & 0xff;
      rk[4*j+2] = (word >>> 8) & 0xff;
      rk[4*j+3] = word & 0xff;
    }
    roundKeys.push(rk);
  }
  return roundKeys;
}

function aesEncryptBlock(block, roundKeys) {
  let state = new Uint8Array(block);
  for (let i = 0; i < 16; i++) state[i] ^= roundKeys[0][i];
  
  for (let round = 1; round <= 14; round++) {
    for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]];
    // ShiftRows
    const t1 = state[1];
    state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = t1;
    const t2a = state[2]; const t2b = state[6];
    state[2] = state[10]; state[6] = state[14]; state[10] = t2a; state[14] = t2b;
    const t3 = state[3];
    state[3] = state[15]; state[15] = state[11]; state[11] = state[7]; state[7] = t3;
    
    if (round < 14) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const a0 = state[i], a1 = state[i+1], a2 = state[i+2], a3 = state[i+3];
        state[i]   = xtime(a0) ^ (xtime(a1) ^ a1) ^ a2 ^ a3;
        state[i+1] = a0 ^ xtime(a1) ^ (xtime(a2) ^ a2) ^ a3;
        state[i+2] = a0 ^ a1 ^ xtime(a2) ^ (xtime(a3) ^ a3);
        state[i+3] = (xtime(a0) ^ a0) ^ a1 ^ a2 ^ xtime(a3);
      }
    }
    for (let i = 0; i < 16; i++) state[i] ^= roundKeys[round][i];
  }
  return state;
}

function ghashMul(x, y) {
  const Z = new Uint8Array(16);
  const V = new Uint8Array(y);
  
  for (let i = 0; i < 128; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = 7 - (i % 8);
    if ((x[byteIdx] >>> bitIdx) & 1) {
      for (let j = 0; j < 16; j++) Z[j] ^= V[j];
    }
    const lsb = V[15] & 1;
    for (let j = 15; j > 0; j--) V[j] = (V[j] >>> 1) | ((V[j-1] & 1) << 7);
    V[0] = V[0] >>> 1;
    if (lsb) V[0] ^= 0xe1;
  }
  return Z;
}

function ghash(h, data) {
  const Y = new Uint8Array(16);
  for (let i = 0; i < data.length; i += 16) {
    for (let j = 0; j < 16; j++) Y[j] ^= data[i + j];
    const result = ghashMul(Y, h);
    Y.set(result);
  }
  return Y;
}

function inc32(block) {
  const result = new Uint8Array(block);
  let c = 1;
  for (let i = 15; i >= 12 && c > 0; i--) {
    const val = result[i] + c;
    result[i] = val & 0xff;
    c = val >>> 8;
  }
  return result;
}

function aes256GcmDecrypt(encryptedData, keyHex) {
  const parts = encryptedData.split('.');
  if (parts.length < 3) return null;
  
  function b64urlToBytes(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice(0, (4 - base64.length % 4) % 4);
    const raw = atob(padded);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }
  
  const iv = b64urlToBytes(parts[0]);
  const c1 = b64urlToBytes(parts[1]);
  const c2 = b64urlToBytes(parts[2]);
  
  const cipherWithTag = new Uint8Array(c1.length + c2.length);
  cipherWithTag.set(c1, 0);
  cipherWithTag.set(c2, c1.length);
  
  const tag = cipherWithTag.slice(-16);
  const ciphertext = cipherWithTag.slice(0, -16);
  
  const keyLen = keyHex.length / 2;
  const key = new Uint8Array(keyLen);
  for (let i = 0; i < keyLen; i++) key[i] = parseInt(keyHex.substr(i*2, 2), 16);
  
  const roundKeys = aesKeyExpansion(key);
  
  const zeroBlock = new Uint8Array(16);
  const H = aesEncryptBlock(zeroBlock, roundKeys);
  
  let J0;
  if (iv.length === 12) {
    J0 = new Uint8Array(16);
    J0.set(iv, 0);
    J0[15] = 0x01;
  } else {
    return null;
  }
  
  const plaintext = new Uint8Array(ciphertext.length);
  let counter = inc32(J0);
  
  for (let offset = 0; offset < ciphertext.length; offset += 16) {
    const keyStream = aesEncryptBlock(counter, roundKeys);
    const remaining = Math.min(16, ciphertext.length - offset);
    for (let j = 0; j < remaining; j++) {
      plaintext[offset + j] = ciphertext[offset + j] ^ keyStream[j];
    }
    counter = inc32(counter);
  }
  
  const paddedCT = new Uint8Array(Math.ceil(ciphertext.length / 16) * 16);
  paddedCT.set(ciphertext, 0);
  
  const lenAAD = 0;
  const lenCT = ciphertext.length;
  
  const lenBlock = new Uint8Array(16);
  const totalBits = lenCT * 8;
  lenBlock[8] = (totalBits >>> 56) & 0xff;
  lenBlock[9] = (totalBits >>> 48) & 0xff;
  lenBlock[10] = (totalBits >>> 40) & 0xff;
  lenBlock[11] = (totalBits >>> 32) & 0xff;
  lenBlock[12] = (totalBits >>> 24) & 0xff;
  lenBlock[13] = (totalBits >>> 16) & 0xff;
  lenBlock[14] = (totalBits >>> 8) & 0xff;
  lenBlock[15] = totalBits & 0xff;
  
  const ghashInput = new Uint8Array(paddedCT.length + 16);
  ghashInput.set(paddedCT, 0);
  ghashInput.set(lenBlock, paddedCT.length);
  
  const S = ghash(H, ghashInput);
  
  const E_J0 = aesEncryptBlock(J0, roundKeys);
  const computedTag = new Uint8Array(16);
  for (let j = 0; j < 16; j++) computedTag[j] = S[j] ^ E_J0[j];
  
  let tagMatch = computedTag.length === tag.length;
  if (tagMatch) {
    for (let j = 0; j < 16; j++) {
      if (computedTag[j] !== tag[j]) { tagMatch = false; break; }
    }
  }
  
  let result = '';
  let i = 0;
  while (i < plaintext.length) {
    const b1 = plaintext[i++];
    if (b1 < 0x80) {
      result += String.fromCharCode(b1);
    } else if (b1 < 0xE0 && i < plaintext.length) {
      result += String.fromCharCode(((b1 & 0x1F) << 6) | (plaintext[i++] & 0x3F));
    } else if (b1 < 0xF0 && i + 1 < plaintext.length) {
      const b2 = plaintext[i++];
      const b3 = plaintext[i++];
      result += String.fromCharCode(((b1 & 0x0F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F));
    } else if (i + 2 < plaintext.length) {
      const b2 = plaintext[i++];
      const b3 = plaintext[i++];
      const b4 = plaintext[i++];
      const cp = ((b1 & 0x07) << 18) | ((b2 & 0x3F) << 12) | ((b3 & 0x3F) << 6) | (b4 & 0x3F);
      result += String.fromCharCode(cp);
    } else break;
  }
  
  return result;
}

async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  try {
    const signal = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout)
      ? AbortSignal.timeout(timeout)
      : null;
    const mergedOptions = { ...options };
    if (signal) mergedOptions.signal = signal;
    if (!mergedOptions.headers) mergedOptions.headers = {};
    return await fetch(url, mergedOptions);
  } catch (e) {
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      throw new Error("[" + PROVIDER_NAME + "] Timeout: " + url.substring(0, 80));
    }
    throw e;
  }
}

async function fetchFromServer(server, tmdbId, mediaType, season, episode, mediaTitle, mediaYear) {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  let url = server.url + "/" + type + "/" + tmdbId;
  if (type === 'tv' && season !== null && episode !== null) {
    url += "/" + season + "/" + episode;
  }
  
  const mediaInfo = {
    title: mediaTitle || '',
    year: mediaYear || '',
    season: season,
    episode: episode,
    isTv: type === 'tv'
  };
  
  const labels = {
    origin: "https://peachify.top",
    referer: "https://peachify.top/"
  };
  
  console.log("[" + PROVIDER_NAME + "] Fetching " + server.label + ": " + url);
  
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": HEADERS["User-Agent"],
        "Accept": HEADERS["Accept"],
        "Origin": labels.origin,
        "Referer": labels.referer,
      }
    });
    
    if (!res.ok) {
      console.log("[" + PROVIDER_NAME + "] " + server.label + " returned " + res.status);
      return null;
    }
    
    const body = await res.text();
    console.log("[" + PROVIDER_NAME + "] " + server.label + " response length: " + body.length);
    
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      console.log("[" + PROVIDER_NAME + "] " + server.label + " not JSON: " + body.substring(0, 100));
      return null;
    }
    
    if (!json.isEncrypted) {
      console.log("[" + PROVIDER_NAME + "] " + server.label + " unencrypted response");
      return parseStreamData(json, server, mediaInfo);
    }
    
    if (json.isEncrypted && json.data) {
      console.log("[" + PROVIDER_NAME + "] " + server.label + " encrypted data: " + json.data.substring(0, 50) + "...");
      
      if (PROXY_URL) {
        console.log("[" + PROVIDER_NAME + "] Using proxy for decryption...");
        const decrypted = await decryptViaProxy(json.data, server);
        if (decrypted) {
          const parsed = parseDecryptedData(decrypted, server, mediaInfo);
          return parsed;
        }
        console.log("[" + PROVIDER_NAME + "] Proxy decryption failed, falling back to direct...");
      }
      
      console.log("[" + PROVIDER_NAME + "] Decrypting directly with AES-256-GCM...");
      try {
        const decrypted = aes256GcmDecrypt(json.data, AES_KEY_HEX);
        if (decrypted) {
          console.log("[" + PROVIDER_NAME + "] Decrypted: " + decrypted.substring(0, 200));
          const parsed = parseDecryptedData(decrypted, server, mediaInfo);
          return parsed;
        }
      } catch (eDec) {
        console.log("[" + PROVIDER_NAME + "] Direct decryption failed: " + eDec.message);
      }
      
      return null;
    }
    
    console.log("[" + PROVIDER_NAME + "] " + server.label + " unexpected format");
    return null;
    
  } catch (e) {
    console.log("[" + PROVIDER_NAME + "] " + server.label + " error: " + e.message);
    return null;
  }
}

async function decryptViaProxy(encryptedData, server) {
  try {
    const proxyUrl = PROXY_URL + "?action=decrypt&data=" + encodeURIComponent(encryptedData) + "&server=" + encodeURIComponent(server.key);
    const res = await fetchWithTimeout(proxyUrl, {}, 20000);
    if (!res.ok) {
      console.log("[" + PROVIDER_NAME + "] Proxy returned " + res.status);
      return null;
    }
    const proxyRes = await res.json();
    if (proxyRes.code === 0 && proxyRes.data) {
      // Proxy can return either the full decrypted JSON or just the stream data
      if (typeof proxyRes.data === 'string') return proxyRes.data;
      return JSON.stringify(proxyRes.data);
    }
    return null;
  } catch (e) {
    console.log("[" + PROVIDER_NAME + "] Proxy error: " + e.message);
    return null;
  }
}

function parseDecryptedData(decryptedStr, server, mediaInfo) {
  try {
    const data = JSON.parse(decryptedStr);
    return parseStreamData(data, server, mediaInfo);
  } catch (e) {
    if (decryptedStr.startsWith('http://') || decryptedStr.startsWith('https://') || decryptedStr.startsWith('//')) {
      let url = decryptedStr;
      if (url.startsWith('//')) url = 'https:' + url;
      var displayTitle = mediaInfo && mediaInfo.title ? mediaInfo.title : server.label;
      var displaySeason = mediaInfo && mediaInfo.isTv && mediaInfo.season ? ' S' + padNum(mediaInfo.season) + 'E' + padNum(mediaInfo.episode) : '';
      return [{
        name: (mediaInfo && mediaInfo.title ? mediaInfo.title : server.label) + displaySeason + " | " + "HD",
        title: displayTitle + (mediaInfo && mediaInfo.year ? ' (' + mediaInfo.year + ')' : '') + displaySeason + "\n" + "HD · Direct",
        url: url,
        quality: "1080p",
        headers: {
          "Referer": "https://peachify.top/",
          "Origin": "https://peachify.top",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }];
    }
    return null;
  }
}

function padNum(n) { return n < 10 ? '0' + n : '' + n; }

function getFormat(url) {
  var u = url.toLowerCase();
  if (u.includes('.m3u8')) return 'HLS';
  if (u.includes('.mp4')) return 'MP4';
  if (u.includes('.mkv')) return 'MKV';
  // Check URL params for format hints
  if (u.includes('m3u8-proxy') || u.includes('/hls/') || u.includes('master.m3u8')) return 'HLS';
  if (u.includes('mp4-proxy')) return 'MP4';
  return '';
}

function parseStreamData(json, server, mediaInfo) {
  if (!json) return null;
  
  var isTv = mediaInfo && mediaInfo.isTv;
  var showTitle = mediaInfo && mediaInfo.title ? mediaInfo.title : '';
  var showYear = mediaInfo && mediaInfo.year ? '(' + mediaInfo.year + ')' : '';
  var epLabel = '';
  if (isTv && mediaInfo.season != null && mediaInfo.episode != null) {
    epLabel = ' S' + padNum(mediaInfo.season) + 'E' + padNum(mediaInfo.episode);
  }
  var baseDisplay = showTitle + showYear + epLabel;
  if (!baseDisplay) baseDisplay = server.label;
  
  const streams = [];
  
  let sources = json.sources || json.source || json.data || [];
  if (!Array.isArray(sources)) sources = [sources];
  
  const directUrl = json.url || json.file || json.playUrl || json.playurl || json.streamUrl || json.src || null;
  if (directUrl && sources.length === 0) {
    sources = [{ url: directUrl }];
  }
  
  for (const src of sources) {
    const url = src.url || src.file || src.src || src.playUrl || null;
    if (!url) continue;
    
    let cleanUrl = String(url);
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    
    const label = src.label || src.quality || src.name || src.qualityLabel || 'HD';
    const quality = normalizeQuality(label + ' ' + (src.resolution || ''));
    
    const dub = (src.dub || src.language || src.lang || src.audio || '').trim();
    var shortDub = dub.replace(/^Original Audio$/i, 'Original').replace(/^English Dub$/i, 'English');
    var langTag = shortDub ? ' · ' + shortDub : '';
    var nameLang = shortDub ? ' | ' + shortDub : '';
    
    var fmt = getFormat(cleanUrl);
    var fmtTag = fmt ? ' · ' + fmt : '';
    
    const subtitles = parseSubtitles(json.tracks || json.subtitles || json.subs || src.tracks || []);
    
    var sizeTag = '';
    if (src.size) sizeTag = ' · ' + src.size;
    if (src.filesize) sizeTag = ' · ' + src.filesize;
    
    var streamName = baseDisplay + " | " + quality + nameLang;
    
    var streamTitle = baseDisplay + "\n" + quality + fmtTag + langTag + " · " + server.label + sizeTag;
    
    streams.push({
      name: streamName,
      title: streamTitle,
      url: cleanUrl,
      quality: quality,
      headers: {
        "Referer": "https://peachify.top/",
        "Origin": "https://peachify.top",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      subtitles: subtitles
    });
  }
  
  // Fallback if no sources found but direct URL
  if (streams.length === 0 && directUrl) {
    streams.push({
      name: baseDisplay + " | HD",
      title: baseDisplay + "\n" + "HD · " + server.label,
      url: String(directUrl),
      quality: "1080p",
      headers: {
        "Referer": "https://peachify.top/",
        "Origin": "https://peachify.top",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
  }
  
  return streams.length > 0 ? streams : null;
}

function parseSubtitles(tracks) {
  if (!tracks || !Array.isArray(tracks)) return [];
  return tracks
    .filter(t => t.file || t.url)
    .map(t => ({
      label: t.label || t.language || t.lang || 'Unknown',
      url: t.file || t.url
    }));
}

function normalizeQuality(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('2160') || t.includes('4k') || t.includes('uhd')) return '2160p';
  if (t.includes('1440')) return '1440p';
  if (t.includes('1080')) return '1080p';
  if (t.includes('720')) return '720p';
  if (t.includes('480')) return '480p';
  if (t.includes('360')) return '360p';
  return 'HD';
}

function resolveUrl(base, relative) {
  if (!relative) return base;
  if (relative.startsWith('https://') || relative.startsWith('http://')) return relative;
  if (relative.startsWith('//')) return 'https:' + relative;
  if (relative.startsWith('/')) {
    const origin = base.split('//')[0] + '//' + base.split('//')[1].split('/')[0];
    return origin + relative;
  }
  const basePath = base.endsWith('/') ? base : base.substring(0, base.lastIndexOf('/') + 1);
  return basePath + relative;
}

async function getTMDBInfo(id, type) {
  const idStr = String(id).trim();
  const isImdbId = idStr.startsWith('tt');
  const tmdbType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';

  try {
    if (isImdbId) {
      console.log("[" + PROVIDER_NAME + "] IMDB ID: " + idStr);
      const res = await fetchWithTimeout(
        "https://api.themoviedb.org/3/find/" + idStr + "?api_key=" + TMDB_API_KEY + "&external_source=imdb_id"
      );
      if (res.ok) {
        const data = await res.json();
        const results = tmdbType === 'tv' ? data.tv_results : data.movie_results;
        if (results && results.length > 0) {
          const item = results[0];
          return {
            id: item.id,
            title: tmdbType === 'tv' ? item.name : item.title,
            year: (item.first_air_date || item.release_date || '').split('-')[0]
          };
        }
      }
      // Fallback: try raw ID
      return { id: idStr, title: idStr, year: null };
    } else {
      // Numeric ID (TV mode) — just use directly
      // Get title for logging
      const res = await fetchWithTimeout(
        "https://api.themoviedb.org/3/" + tmdbType + "/" + idStr + "?api_key=" + TMDB_API_KEY
      );
      if (res.ok) {
        const data = await res.json();
        return {
          id: data.id,
          title: tmdbType === 'tv' ? data.name : data.title,
          year: (data.first_air_date || data.release_date || '').split('-')[0]
        };
      }
      return { id: idStr, title: idStr, year: null };
    }
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] TMDB error: " + e.message);
    return { id: idStr, title: String(idStr), year: null };
  }
}

function deduplicateStreams(streams) {
  const seen = new Set();
  return streams.filter(s => {
    const key = s.url || s.title || '';
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortStreamsByQuality(streams) {
  const order = { '2160p': 5, '4k': 5, '1440p': 4, '1080p': 3, '720p': 2, '480p': 1, '360p': 0 };
  return streams.sort((a, b) => {
    const qa = order[a.quality?.toLowerCase()] ?? 0;
    const qb = order[b.quality?.toLowerCase()] ?? 0;
    return qb - qa;
  });
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log("[" + PROVIDER_NAME + "] Request: ID=" + tmdbId + ", Type=" + mediaType + ", S=" + season + ", E=" + episode);
    
    const media = await getTMDBInfo(tmdbId, mediaType);
    console.log("[" + PROVIDER_NAME + "] Resolved: \"" + media.title + "\" (TMDB ID: " + media.id + ")");
    
    const results = await Promise.allSettled(
      SERVERS.map(server => fetchFromServer(server, media.id, mediaType, season, episode, media.title, media.year))
    );
    
    const allStreams = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value && Array.isArray(r.value) && r.value.length > 0) {
        allStreams.push(...r.value);
        console.log("[" + PROVIDER_NAME + "] " + SERVERS[i].label + " returned " + r.value.length + " streams");
      } else if (r.status === 'rejected') {
        console.log("[" + PROVIDER_NAME + "] " + SERVERS[i].label + " rejected: " + r.reason);
      }
    }
    
    if (allStreams.length === 0) {
      console.log("[" + PROVIDER_NAME + "] No streams from any server.");
      return [];
    }
    
    const finalStreams = sortStreamsByQuality(deduplicateStreams(allStreams));
    console.log("[" + PROVIDER_NAME + "] Returning " + finalStreams.length + " unique streams.");
    return finalStreams;
    
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] Fatal: " + e.message);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
