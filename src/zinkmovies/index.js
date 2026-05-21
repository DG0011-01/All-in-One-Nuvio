// ZinkMovies scraper for Nuvio — piratezoro9
// yeah those quotes up there are cool n all but lets be real
// we just here to scrape streams, not save the world
// embed first, then fsl from hubcloud, av1 tagged so u know

const cheerio = require('cheerio-without-node-native');
const CryptoJS = require('crypto-js');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PROVIDER_NAME   = "Asura | ZinkMovies";
const MAIN_URL        = "https://new8.zinkmovies.biz";
const TMDB_API_KEY    = "439c478a771f35c05022f9feabcca01c";
const HRUJO_KEY       = "1EN-Yy+CfM39lPQMhPhiCSKDaYA6mRO++nHNRq9ZfhtGHPwC8DWQq9q5IGK49Iqc";
const REQUEST_TIMEOUT = 15000;

// gamerxyt wants xyt=1 cookie + right Referer or it just shows cloudflare crap
const HUBCLOUD_COOKIES = 'xla=s4t; xyt=1';

const HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Connection":      "keep-alive"
};

let visitedUrls    = new Set();
let processedFiles = new Set();

// ═══════════════════════════════════════════════════════
// SECTION 1 — CORE HELPERS
// ═══════════════════════════════════════════════════════

async function fetchSafe(url, options = {}, timeout = REQUEST_TIMEOUT) {
  try {
    const signal = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout)
      ? AbortSignal.timeout(timeout)
      : null;
    const merged = { ...options, headers: { ...HEADERS, ...(options.headers || {}) } };
    if (signal) merged.signal = signal;
    const res = await fetch(url, merged);
    return res;
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] fetchSafe error: " + url.substring(0, 100) + " -> " + e.message);
    return null;
  }
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetchSafe(url, options);
    if (!res || !res.ok) {
      console.error("[" + PROVIDER_NAME + "] fetchJson failed: " + (res ? res.status : 'null') + " " + url.substring(0, 100));
      return null;
    }
    return JSON.parse(await res.text());
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] fetchJson parse error: " + url.substring(0, 100) + " -> " + e.message);
    return null;
  }
}

async function fetchHtml(url, options = {}) {
  try {
    const res = await fetchSafe(url, options);
    if (!res || !res.ok) {
      console.error("[" + PROVIDER_NAME + "] fetchHtml failed: " + (res ? res.status : 'null') + " " + url.substring(0, 100));
      return null;
    }
    return cheerio.load(await res.text());
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] fetchHtml error: " + url.substring(0, 100) + " -> " + e.message);
    return null;
  }
}

function parseQuality(text) {
  const t = (text || '').toUpperCase();
  if (t.includes('2160') || t.includes('4K') || t.includes('UHD')) return '2160P';
  if (t.includes('1080')) return '1080P';
  if (t.includes('720'))  return '720P';
  if (t.includes('480'))  return '480P';
  return 'HD';
}

function similarity(s1, s2, year) {
  if (!s1 || !s2) return 0;
  const clean = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const w1 = clean(s1);
  const w2 = clean(s2);
  const w2Set = new Set(w2);
  const intersection = w1.filter(x => w2Set.has(x)).length;
  let score = intersection / Math.max(w1.length, 1);

  // Short query prefix check: if query has ≤4 words, its character prefix MUST
  // match the result start, or it's a false match (e.g. "The Boys" vs
  // "To All the Boys I've Loved Before")
  if (w1.length <= 4 && score > 0) {
    const s1lower = s1.toLowerCase().trim();
    const s2lower = s2.toLowerCase().trim();
    const prefixLen = Math.min(s1lower.length, s2lower.length);
    if (s2lower.substring(0, prefixLen) !== s1lower.substring(0, prefixLen)) {
      score = Math.max(0, score - 0.5);
    }
  }

  if (year && String(s2).includes(String(year))) score += 0.3;
  if (s2.toLowerCase().startsWith(s1.toLowerCase())) score += 0.2;
  if (year && w1.length <= 3) {
    // Short title penalty: year mismatch costs heavily
    const ym = s2.match(/\b(19|20)\d{2}\b/);
    if (ym && Math.abs(parseInt(ym[0]) - parseInt(year)) > 1) score -= 0.8;
  }
  return Math.min(score, 1.0);
}

async function chunkAll(taskFns, size = 3) {
  const results = [];
  for (let i = 0; i < taskFns.length; i += size) {
    const batch = await Promise.all(taskFns.slice(i, i + size).map(async (fn) => {
      try { return await fn(); } catch (e) { return []; }
    }));
    batch.forEach(r => results.push(...(Array.isArray(r) ? r : (r ? [r] : []))));
  }
  return results;
}

function dedupe(streams) {
  const seen = new Set();
  return (streams || []).filter(s => {
    if (!s || !s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

function makeStream(name, title, url, quality, headers = {}) {
  return {
    name: PROVIDER_NAME + ' | ' + name,
    title, url, quality,
    headers: { 'User-Agent': HEADERS['User-Agent'], ...headers }
  };
}

function getOrigin(url) {
  try {
    const parts = url.split('//');
    if (parts.length < 2) return url;
    return parts[0] + '//' + parts[1].split('/')[0];
  } catch (e) { return url; }
}

// ═══════════════════════════════════════════════════════
// SECTION 2 — TMDB RESOLVER
// ═══════════════════════════════════════════════════════

async function getTMDBInfo(id, type) {
  const idStr    = String(id || '').trim();
  const isImdb   = idStr.startsWith('tt');
  const tmdbType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
  try {
    if (isImdb) {
      const data = await fetchJson('https://api.themoviedb.org/3/find/' + idStr + '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id');
      const list = data ? (tmdbType === 'tv' ? data.tv_results : data.movie_results) : null;
      if (list && list.length > 0) {
        const item = list[0];
        return {
          title: tmdbType === 'tv' ? item.name : item.title,
          year: (item.first_air_date || item.release_date || '').split('-')[0],
          imdbId: idStr
        };
      }
      return { title: idStr, year: null, imdbId: idStr };
    } else {
      const data = await fetchJson('https://api.themoviedb.org/3/' + tmdbType + '/' + idStr + '?api_key=' + TMDB_API_KEY + '&append_to_response=external_ids');
      if (data) {
        const imdbId = data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null;
        return {
          title: tmdbType === 'tv' ? data.name : data.title,
          year: (data.first_air_date || data.release_date || '').split('-')[0],
          imdbId
        };
      }
    }
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] TMDB error: " + e.message);
  }
  return { title: idStr, year: null, imdbId: null };
}

// ═══════════════════════════════════════════════════════
// SECTION 3 — SITE SEARCH
// ═══════════════════════════════════════════════════════

async function searchSite(title, year) {
  const url = MAIN_URL + '/?s=' + encodeURIComponent(title);
  console.log("[" + PROVIDER_NAME + "] Search: " + url);
  try {
    const $ = await fetchHtml(url, { headers: HEADERS });
    if (!$) {
      console.log("[" + PROVIDER_NAME + "] Search: no HTML returned");
      return [];
    }
    const results = [];
    $(".result-item article, article.item, article").each((i, el) => {
      const linkEl = $(el).find('.title a, h2 a, h3 a').first();
      const itemTitle = linkEl.text().trim();
      const href = linkEl.attr('href');
      if (href && itemTitle) {
        results.push({ title: itemTitle, href, year: (itemTitle.match(/\d{4}/) || [null])[0] });
      }
    });
    console.log("[" + PROVIDER_NAME + "] Search: found " + results.length + " results for '" + title + "'");
    return results;
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] Search error: " + e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════
// SECTION 4 — EMBED RESOLVER (FIXED: balanced brace matching)
// ═══════════════════════════════════════════════════════

// pulls out a { } block from the html, handles nested ones unlike regex
function extractBraceObject(str, startIdx) {
  if (str[startIdx] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < str.length; i++) {
    const c = str[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"' && !inString) { inString = true; continue; }
    if (c === '"' && inString) { inString = false; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (depth === 0) return str.substring(startIdx, i + 1);
  }
  return null;
}

// aes-256-cbc decrypt — buddy from the bounty board cracked this
// key = base64 of hrujo key, iv = first 16 chars of p3.key
function decryptPlaylist(encryptedText, p3Key) {
  if (!encryptedText || !CryptoJS) return encryptedText;
  if (!p3Key || p3Key.length < 16) return encryptedText;
  
  const ivStr = p3Key.substring(0, 16);
  
  // method 1 — decode the hrujo key from base64
  try {
    const key = CryptoJS.enc.Base64.parse(HRUJO_KEY);
    const iv = CryptoJS.enc.Utf8.parse(ivStr);
    const decrypted = CryptoJS.AES.decrypt(encryptedText, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (result && result.length > 0) {
      console.log("[" + PROVIDER_NAME + "] Embed: AES-256 decrypt OK (" + result.length + " bytes)");
      return result;
    }
  } catch(e) {
    console.log("[" + PROVIDER_NAME + "] Embed: AES-256 try 1 failed: " + e.message);
  }
  
  // method 2 — just use the key directly as utf8 if base64 didnt work
  try {
    const key = CryptoJS.enc.Utf8.parse(p3Key.substring(0, 32));
    const iv = CryptoJS.enc.Utf8.parse(ivStr);
    const decrypted = CryptoJS.AES.decrypt(encryptedText, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (result && result.length > 0) {
      console.log("[" + PROVIDER_NAME + "] Embed: AES-256 try 2 OK (" + result.length + " bytes)");
      return result;
    }
  } catch(e) {
    console.log("[" + PROVIDER_NAME + "] Embed: AES-256 try 2 failed: " + e.message);
  }
  
  return encryptedText; // fallback: return as-is
}

async function resolveEmbed(imdbId, label, isTv = false, season, episode) {
  if (!imdbId) return [];
  try {
    // tv shows need ?s=S&e=E in the url or the embed wont load the right episode
    let playerUrl = 'https://hrujo406fix.com/play/' + imdbId;
    if (isTv && season && episode) {
      playerUrl += '?s=' + season + '&e=' + episode;
    }
    console.log("[" + PROVIDER_NAME + "] Embed: fetching " + playerUrl);
    // embed server checks referer — without it it returns 404
    const res = await fetchSafe(playerUrl, {
      headers: { ...HEADERS, 'Referer': 'https://new8.zinkmovies.biz/', 'Origin': 'https://new8.zinkmovies.biz' }
    }, 10000);
    if (!res) {
      console.log("[" + PROVIDER_NAME + "] Embed: fetch returned null");
      return [];
    }
    if (!res.ok) {
      console.log("[" + PROVIDER_NAME + "] Embed: page fetch failed (" + res.status + ")");
      return [];
    }
    const html = await res.text();
    console.log("[" + PROVIDER_NAME + "] Embed: page OK (" + html.length + " bytes)");
    
    // find the p3 object in the page — script stores it in a few different ways
    let p3Raw = null;
    // check if it's just a regular variable
    const p3VarPatterns = ['let p3 = ', 'var p3 = ', 'const p3 = ', 'window.p3 = ', 'p3 = '];
    for (const pat of p3VarPatterns) {
      const idx = html.indexOf(pat);
      if (idx >= 0) {
        const braceIdx = html.indexOf('{', idx + pat.length);
        if (braceIdx >= 0) { p3Raw = extractBraceObject(html, braceIdx); if (p3Raw) break; }
      }
    }
    // sometimes its inside new HDVBPlayer(...) — grab the arg
    if (!p3Raw) {
      const hdvIdx = html.indexOf('new HDVBPlayer(');
      if (hdvIdx >= 0) {
        const argStart = hdvIdx + 'new HDVBPlayer('.length;
        const argEnd = html.indexOf(')', argStart);
        if (argEnd > argStart) {
          const varName = html.substring(argStart, argEnd).trim();
          // Search for that variable's definition
          const varIdx = html.indexOf(varName + ' = ');
          if (varIdx >= 0) {
            const braceIdx = html.indexOf('{', varIdx + varName.length + 3);
            if (braceIdx >= 0) p3Raw = extractBraceObject(html, braceIdx);
          }
        }
      }
    }
    // last resort — look for any inline json-looking script block
    if (!p3Raw) {
      const scriptStart = html.indexOf('<script');
      while (scriptStart >= 0) {
        const closeTag = html.indexOf('>', scriptStart);
        const scriptEnd = html.indexOf('</script>', closeTag);
        if (closeTag < 0 || scriptEnd < 0) break;
        const content = html.substring(closeTag + 1, scriptEnd).trim();
        if (content.startsWith('{')) {
          try { JSON.parse(content); p3Raw = content; break; } catch {}
          try { JSON.parse(content.replace(/\\\//g, '/')); p3Raw = content.replace(/\\\//g, '/'); break; } catch {}
        }
        break; // only check first script tag
      }
    }
    
    if (!p3Raw) {
      console.log("[" + PROVIDER_NAME + "] Embed: p3 object not found (preview: " + html.substring(0, 120).replace(/\n/g, ' ') + ")");
      return [];
    }
    
    let p3;
    try {
      p3 = JSON.parse(p3Raw);
    } catch (e) {
      // Try with escaped slashes
      try { p3 = JSON.parse(p3Raw.replace(/\\\//g, '/')); } catch { 
        console.log("[" + PROVIDER_NAME + "] Embed: p3 JSON parse failed");
        return [];
      }
    }
    if (!p3.file || !p3.key) {
      console.log("[" + PROVIDER_NAME + "] Embed: p3 missing file or key");
      return [];
    }

    let currentUrl = '';

    // tv shows have p3.file as a nested thing — season > episode > hash
    if (isTv && typeof p3.file === 'object' && p3.file !== null) {
      const s = String(season || 1);
      const e = String(episode || 1);
      let hash = '';
      
      if (Array.isArray(p3.file)) {
        // array like  [season, episode, hash]
        for (const entry of p3.file) {
          if (entry && String(entry[0]) === s && String(entry[1]) === e && entry[2]) {
            hash = entry[2];
            break;
          }
        }
      } else {
        // nested object  { season: { episode: hash } }
        const seasonObj = p3.file[s];
        if (seasonObj && seasonObj[e]) hash = seasonObj[e];
      }
      
      if (!hash) {
        console.log("[" + PROVIDER_NAME + "] Embed: no hash for S" + s + "E" + e);
        return [];
      }
      console.log("[" + PROVIDER_NAME + "] Embed: TV hash " + hash.substring(0, 40) + "...");
      currentUrl = 'https://hrujo406fix.com/playlist/' + hash + '.txt';
    } else {
      // movies just have the url directly
      currentUrl = p3.file.startsWith('http') ? p3.file : 'https://hrujo406fix.com' + p3.file;
    }

    console.log("[" + PROVIDER_NAME + "] Embed: playlist URL = " + currentUrl.substring(0, 100));

    // playlist might have redirects to follow — max 3 hops
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log("[" + PROVIDER_NAME + "] Embed: POST attempt " + (attempt + 1) + " -> " + currentUrl.substring(0, 80));
      const fRes = await fetchSafe(currentUrl, {
        method: 'POST',
        headers: { ...HEADERS, 'Referer': playerUrl, 'X-CSRF-TOKEN': p3.key, 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (!fRes || !fRes.ok) {
        console.log("[" + PROVIDER_NAME + "] Embed: POST failed (" + (fRes ? fRes.status : 'null') + ")");
        break;
      }
      const data = (await fRes.text()).trim();
      console.log("[" + PROVIDER_NAME + "] Embed: response (" + data.length + " bytes) starts with: " + data.substring(0, 80));
      // decrypt the response — its aes encrypted with the hrujo key
      let finalUrl = decryptPlaylist(data, p3.key);
      
      if (data.startsWith('[') || data.startsWith('{')) {
        try {
          const json = JSON.parse(data);
          // the json can have nested folders — dig until we find a file field
          const findFile = (obj) => {
            if (!obj) return '';
            if (obj.file) return obj.file;
            if (obj.folder && Array.isArray(obj.folder) && obj.folder.length > 0) {
              for (const f of obj.folder) {
                const result = findFile(f);
                if (result) return result;
              }
            }
            return '';
          };
          const item = Array.isArray(json) ? json[0] : json;
          finalUrl = findFile(item) || '';
        } catch { 
          console.log("[" + PROVIDER_NAME + "] Embed: JSON parse of response failed");
          break; 
        }
      }
      if (!finalUrl) {
        console.log("[" + PROVIDER_NAME + "] Embed: no URL in response");
        break;
      }
      if (finalUrl.startsWith('~')) {
        currentUrl = 'https://hrujo406fix.com/playlist/' + finalUrl.substring(1) + '.txt';
        console.log("[" + PROVIDER_NAME + "] Embed: following hash -> " + currentUrl.substring(0, 80));
        continue;
      }
      if (finalUrl.includes('m3u8') || finalUrl.includes('.mp4')) {
        console.log("[" + PROVIDER_NAME + "] Embed: found stream -> " + finalUrl.substring(0, 80));
        return [makeStream('Embed | Multi', label + ' [HLS Player]', finalUrl, 'Multi', { 'Referer': 'https://hrujo406fix.com/' })];
      }
      break;
    }
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] Embed fatal: " + e.message);
  }
  return [];
}

// ═══════════════════════════════════════════════════════
// SECTION 5 — ZINKCLOUD HOSTERS (HubCloud FSL, Embed)
// ═══════════════════════════════════════════════════════

// takes a hubcloud landing page and gets FSL download links from the bridge
// called from zinkcloud, linkstore, and page extraction
// 10gbps removed — googleusercontent links dont support range requests for exoplayer
async function resolveHubCloud(url, label, quality) {
  if (visitedUrls.has(url)) return [];
  visitedUrls.add(url);
  try {
    let bridgeUrl = url;
    if (!url.includes('hubcloud.php')) {
      console.log("[" + PROVIDER_NAME + "] HubCloud: fetching landing page " + url.substring(0, 80));
      // hubcloud wants these cookies or it throws cloudflare at us
      const hubHeaders = { ...HEADERS, 'Referer': 'https://hubcloud.one/', 'Cookie': HUBCLOUD_COOKIES };
      const $ = await fetchHtml(url, { headers: hubHeaders });
      if (!$) {
        console.log("[" + PROVIDER_NAME + "] HubCloud: landing page fetch failed");
        return [];
      }
      // the page has a var url = '...' with the bridge url
      const html = $.html();
      const varUrlMatch = html.match(/var url\s*=\s*'([^']+)'/);
      if (varUrlMatch) {
        bridgeUrl = varUrlMatch[1];
        console.log("[" + PROVIDER_NAME + "] HubCloud: found bridge URL -> " + bridgeUrl.substring(0, 100));
      } else {
        const downloadHref = $('#download').attr('href') || $('a').filter((i, el) => $(el).attr('href')?.includes('hubcloud.php')).attr('href');
        if (!downloadHref) {
          console.log("[" + PROVIDER_NAME + "] HubCloud: no bridge URL found");
          return [];
        }
        bridgeUrl = downloadHref.startsWith('http') ? downloadHref : getOrigin(url) + '/' + downloadHref.replace(/^\//, '');
      }
    }
    
    console.log("[" + PROVIDER_NAME + "] HubCloud: fetching bridge page " + bridgeUrl.substring(0, 100));
    // gamerxyt bridge — needs xyt=1 cookie or it just serves cloudflare junk
    const bridgeRes = await fetchSafe(bridgeUrl, {
      headers: { ...HEADERS, 'Referer': 'https://hubcloud.one/', 'Cookie': HUBCLOUD_COOKIES }
    });
    if (!bridgeRes) return [];
    const bridgeHtml = await bridgeRes.text();
    const $b = cheerio.load(bridgeHtml);
    const headerText = $b('div.card-header').text() || '';
    const detectedQuality = parseQuality(headerText) || quality;
    const streams = [];
    const bridgeRef = bridgeUrl;
    
    // look for fsl buttons on the bridge page, skip everything else
    $b('a.btn').each((i, el) => {
      const link = $b(el).attr('href');
      const text = $b(el).text().trim();
      const labelTxt = $b(el).text().toLowerCase();
      if (!link) return;
      
      if (labelTxt.includes('fsl')) {
        const synced = link + '1' + new Date().getMinutes();
        // tag av1 streams — older tvs cant play them in exoplayer, falls back to mpv
        const isAv1 = headerText.includes('AV1') || labelTxt.includes('av1');
        const codecTag = isAv1 ? ' ⚠️AV1' : '';
        console.log("[" + PROVIDER_NAME + "] HubCloud: FSL link found (quality=" + detectedQuality + (isAv1 ? ', AV1' : '') + ")");
        streams.push(makeStream('FSL' + codecTag + ' | ' + detectedQuality, text + ' [' + headerText + ']', synced, detectedQuality, { 'Referer': bridgeRef }));
      }
    });
    
    console.log("[" + PROVIDER_NAME + "] HubCloud: found " + streams.length + " playable streams");
    return streams;
  } catch (e) { 
    console.error("[" + PROVIDER_NAME + "] HubCloud error: " + e.message);
    return []; 
  }
}

async function resolveZinkCloud(url, label, quality) {
  const fileID = url.split('/').pop();
  if (processedFiles.has(fileID)) return [];
  processedFiles.add(fileID);
  try {
    const domain = getOrigin(url);
    console.log("[" + PROVIDER_NAME + "] ZinkCloud: fileID=" + fileID + " quality=" + quality);
    
    // first get a token from zinkcloud
    const tokenData = await fetchJson(domain + '/ajax_generate_token.php?random_id=' + fileID, {
      method: 'POST',
      headers: { ...HEADERS, 'Referer': url, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'random_id=' + fileID
    });
    if (!tokenData || tokenData.status !== 'success' || !tokenData.token) {
      console.log("[" + PROVIDER_NAME + "] ZinkCloud: token generation failed");
      return [];
    }
    console.log("[" + PROVIDER_NAME + "] ZinkCloud: token obtained, length=" + tokenData.token.length);
    
    const dlPageUrl = domain + '/dl/' + tokenData.token;
    
    // fetch the dl page — it has hubcloud links for fsl resolution
    console.log("[" + PROVIDER_NAME + "] ZinkCloud: fetching DL page...");
    const dlHtml = await fetchHtml(dlPageUrl, { headers: { ...HEADERS, 'Referer': url } });
    const streams = [];
    
    // Extract ALL HubCloud FSL links from DL page (no cap)
    const hubLinks = [];
    if (dlHtml) {
      dlHtml('a.btn.hubcloud').each((i, el) => {
        const href = dlHtml(el).attr('href');
        if (href) hubLinks.push(href);
      });
    }
    if (hubLinks.length > 0) {
      console.log("[" + PROVIDER_NAME + "] ZinkCloud: resolving " + hubLinks.length + " HubCloud links for FSL");
      const hubResults = await Promise.all(hubLinks.map(href =>
        resolveHubCloud(href, label, quality).catch(() => null)
      ));
      hubResults.forEach((result) => {
        if (result && Array.isArray(result) && result.length > 0) {
          result.forEach(s => { if (s && s.url) streams.push(s); });
        }
      });
    }
    
    console.log("[" + PROVIDER_NAME + "] ZinkCloud: returning " + streams.length + " streams");
    return streams;
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] ZinkCloud fatal: " + e.message);
  }
  return [];
}

// ═══════════════════════════════════════════════════════
// SECTION 6 — LINKSTORE RESOLVER (FIXED: movie bypass)
// ═══════════════════════════════════════════════════════

async function resolveLinkStore(url, targetEpisode, label) {
  try {
    console.log("[" + PROVIDER_NAME + "] LinkStore: fetching " + url.substring(0, 80) + " targetEp=" + targetEpisode);
    const $ = await fetchHtml(url, { headers: HEADERS });
    if (!$) {
      console.log("[" + PROVIDER_NAME + "] LinkStore: page fetch failed");
      return [];
    }
    const tasks = [];
    // if targetEpisode is null/0 its a movie, otherwise match episode numbers
    const isMovie = !targetEpisode;
    
    $('a.maxbutton, a.btn, a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toUpperCase();
      if (!href.startsWith('http') || text.includes('ZIP') || text.includes('ALL EPISODES')) return;
      
      // movies dont have episodes so just grab whatever link we see
      if (isMovie) {
        const quality = parseQuality(text);
        console.log("[" + PROVIDER_NAME + "] LinkStore: movie link " + href.substring(0, 60) + " q=" + quality);
        if (href.includes('zinkcloud.net')) tasks.push(() => resolveZinkCloud(href, label, quality));
        else if (href.includes('hubcloud')) tasks.push(() => resolveHubCloud(href, label, quality));
        return;
      }
      
      // for tv shows, match the button text to the episode number we need
      const epMatch = text.match(/EPISODE\s*-\s*(\d+)/i) || text.match(/EP\s*0*(\d+)/i);
      if (epMatch && parseInt(epMatch[1]) === Number(targetEpisode)) {
        const quality = parseQuality(text);
        console.log("[" + PROVIDER_NAME + "] LinkStore: matched episode " + targetEpisode + " q=" + quality);
        if (href.includes('zinkcloud.net')) tasks.push(() => resolveZinkCloud(href, label, quality));
        else if (href.includes('hubcloud')) tasks.push(() => resolveHubCloud(href, label, quality));
      }
    });
    console.log("[" + PROVIDER_NAME + "] LinkStore: queued " + tasks.length + " tasks");
    return await chunkAll(tasks, 2);
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] LinkStore error: " + e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════
// SECTION 7 — PAGE EXTRACTION
// ═══════════════════════════════════════════════════════

async function extractFromPage(pageUrl, label, isTv = false, targetSeason, targetEpisode) {
  try {
    console.log("[" + PROVIDER_NAME + "] extractFromPage: " + pageUrl.substring(0, 80) + " isTv=" + isTv + " S=" + targetSeason + " E=" + targetEpisode);
    const $ = await fetchHtml(pageUrl, { headers: HEADERS });
    if (!$) {
      console.log("[" + PROVIDER_NAME + "] extractFromPage: no HTML");
      return [];
    }
    const collected = [];
    $('a.movie-simple-button, a.btn').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toUpperCase();
      if (!href.startsWith('http') || text.includes('ZIP')) return;
      const quality = parseQuality(text);
      
      if (isTv) {
        let sNum = null;
        // check if the button itself says "Season X"
        const sMatch = text.match(/SEASON\s*0*(\d+)/i);
        if (sMatch) {
          sNum = parseInt(sMatch[1]);
        } else {
          // if not, look at the page title or somewhere else for the season number
          const pageSeason = $.html().match(/Season\s*(\d+)/i);
          if (pageSeason) sNum = parseInt(pageSeason[1]);
        }
        // cant figure out the season? just include it and let linkstore filter by ep
        if (sNum === targetSeason || sNum === null) {
          collected.push({ href, text, quality });
        }
      } else {
        // Movie: collect ALL buttons
        collected.push({ href, text, quality });
      }
    });
    
    console.log("[" + PROVIDER_NAME + "] extractFromPage: collected " + collected.length + " buttons (no cap)");
    
    const tasks = collected.map(btn => () => {
      if (btn.href.includes('linkstore')) return resolveLinkStore(btn.href, targetEpisode, label + (isTv ? ' S' + targetSeason : ''));
      if (btn.href.includes('zinkcloud.net')) return resolveZinkCloud(btn.href, label, btn.quality);
      if (btn.href.includes('hubcloud')) return resolveHubCloud(btn.href, label, btn.quality);
      return Promise.resolve([]);
    });
    
    const streams = await chunkAll(tasks, 3);
    console.log("[" + PROVIDER_NAME + "] extractFromPage: total " + streams.length + " streams from page");
    return streams;
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] extractFromPage error: " + e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════
// SECTION 8 — MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════

async function getStreams(tmdbId, mediaType, season, episode) {
  visitedUrls = new Set(); processedFiles = new Set();
  try {
    const info = await getTMDBInfo(tmdbId, mediaType);
    if (!info.title) {
      console.log("[" + PROVIDER_NAME + "] No title resolved, returning []");
      return [];
    }
    const isTv = (mediaType === 'tv' || mediaType === 'series');
    console.log("[" + PROVIDER_NAME + "] Request: ID=" + tmdbId + " Type=" + mediaType + " S=" + season + " E=" + episode);
    console.log("[" + PROVIDER_NAME + "] Resolved: \"" + info.title + "\" (" + (info.year || 'N/A') + ") IMDB=" + (info.imdbId || 'none'));
    console.log("[" + PROVIDER_NAME + "] isTv=" + isTv);
    
    const safeSeason = (season != null) ? Number(season) : null;
    const safeEpisode = (episode != null) ? Number(episode) : null;
    
    // fire off embed and site search at the same time — no reason to wait
    const [embedStreams, searchResults] = await Promise.all([
      info.imdbId ? resolveEmbed(info.imdbId, info.title, isTv, safeSeason, safeEpisode) : Promise.resolve([]),
      searchSite(info.title, info.year)
    ]);
    console.log("[" + PROVIDER_NAME + "] Embed streams: " + embedStreams.length + " | Search results: " + searchResults.length);
    
    // pick the best match from search results
    let bestMatch = null, bestScore = 0;
    for (const r of searchResults) {
      const score = similarity(info.title, r.title, info.year);
      if (score > bestScore) { bestScore = score; bestMatch = r; }
    }
    console.log("[" + PROVIDER_NAME + "] Best match: " + (bestMatch ? bestMatch.title + ' (score=' + bestScore.toFixed(2) + ')' : 'NONE'));
    
    // Extract FSL from site page (if match found)
    let fslStreams = [];
    if (bestMatch && bestScore > 0.4) {
      console.log("[" + PROVIDER_NAME + "] Extracting FSL from page: " + bestMatch.href);
      fslStreams = await extractFromPage(bestMatch.href, info.title, isTv, safeSeason, safeEpisode);
    }
    
    // throw em all together, remove dupes, send it back
    const allStreams = dedupe([...embedStreams, ...fslStreams]);
    console.log("[" + PROVIDER_NAME + "] Total unique streams: " + allStreams.length + " (embed=" + embedStreams.length + " fsl=" + fslStreams.length + ")");
    return allStreams;
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] Fatal: " + e.message);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams }; }
else { global.getStreams = getStreams; }
