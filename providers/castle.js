/**
 * castle - Built from src/castle/
 * Generated: 2026-05-10T23:18:38.005Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/castle/constants.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Connection": "keep-alive"
};
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var CASTLE_API = "https://meowtv.vflix.shop";

// src/castle/utils.js
function getStreamHeaders(streamUrl) {
  const isHls = streamUrl.includes(".m3u8");
  const isMp4 = streamUrl.includes(".mp4");
  const isMkv = streamUrl.includes(".mkv");
  return __spreadValues(__spreadValues(__spreadValues(__spreadValues({}, HEADERS), isHls ? { "Accept": "application/vnd.apple.mpegurl,application/x-mpegURL,*/*" } : {}), isMp4 ? { "Accept": "video/mp4,*/*", "Range": "bytes=0-" } : {}), isMkv ? { "Accept": "video/x-matroska,*/*", "Range": "bytes=0-" } : {});
}
function getQualityValue(q) {
  const quality = q.toLowerCase().replace(/p$/, "");
  if (quality === "4k" || quality === "2160")
    return 2160;
  if (quality === "1440")
    return 1440;
  if (quality === "1080")
    return 1080;
  if (quality === "720")
    return 720;
  if (quality === "480")
    return 480;
  if (quality === "360")
    return 360;
  if (quality === "240")
    return 240;
  if (quality === "adaptive" || quality === "auto")
    return 4e3;
  if (quality === "unknown")
    return 0;
  const num = parseInt(quality);
  return isNaN(num) || num <= 0 ? 1 : num;
}
function fetchWithTimeout(_0) {
  return __async(this, arguments, function* (url, options = {}, timeout = 15e3) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const mergedHeaders = __spreadValues(__spreadValues({}, HEADERS), options.headers || {});
      let response = yield fetch(url, __spreadProps(__spreadValues({}, options), { headers: mergedHeaders, signal: controller.signal }));
      if (response.status === 403 || response.status === 503) {
        if (typeof Cloudflare !== "undefined" && Cloudflare.solve) {
          const solved = yield Cloudflare.solve(url);
          if (solved) {
            if (solved["Cookie"])
              mergedHeaders["Cookie"] = solved["Cookie"];
            if (solved["User-Agent"])
              mergedHeaders["User-Agent"] = solved["User-Agent"];
            response = yield fetch(url, __spreadProps(__spreadValues({}, options), { headers: mergedHeaders }));
          }
        }
      }
      clearTimeout(timeoutId);
      return response;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  });
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetchWithTimeout(url, options);
    if (!response.ok)
      throw new Error(`HTTP error ${response.status}`);
    return yield response.text();
  });
}
function getTMDBDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a, _b;
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const response = yield fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok)
      throw new Error(`TMDB API error`);
    const data = yield response.json();
    return {
      title: mediaType === "tv" ? data.name : data.title,
      year: ((_a = mediaType === "tv" ? data.first_air_date : data.release_date) == null ? void 0 : _a.split("-")[0]) || null,
      imdbId: ((_b = data.external_ids) == null ? void 0 : _b.imdb_id) || null,
      mediaType,
      overview: data.overview,
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : ""
    };
  });
}
function extractQuality(url) {
  if (!url)
    return "Unknown";
  const patterns = [/(\d{3,4})p/i, /(\d{3,4})k/i, /quality[_-]?(\d{3,4})/i];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) {
      const q = parseInt(m[1]);
      if (q >= 240 && q <= 4320)
        return `${q}p`;
    }
  }
  if (url.includes(".m3u8"))
    return "Adaptive";
  return "Unknown";
}
function cleanQuality(quality, url) {
  if (!quality || typeof quality !== "string")
    return extractQuality(url);
  if (quality.toLowerCase() === "hd" || quality.toLowerCase() === "high")
    return extractQuality(url) || "720p";
  if (quality.toLowerCase() === "sd" || quality.toLowerCase() === "standard")
    return "480p";
  if (quality.toLowerCase() === "auto")
    return "Auto";
  return extractQuality(url);
}
function sortStreams(streams) {
  return streams.sort((a, b) => getQualityValue(b.quality) - getQualityValue(a.quality));
}
function deduplicateStreams(streams) {
  const seen = /* @__PURE__ */ new Set();
  return streams.filter((s) => {
    if (seen.has(s.url))
      return false;
    seen.add(s.url);
    return true;
  });
}
function formatStreamName(provider, quality, language) {
  let langInfo = language ? ` [${language}]` : "";
  return `${provider}${langInfo} - ${quality}`;
}

// src/castle/index.js
var SKIP_PATTERNS = ["4KHDHub", "Instant Download", "IOSMIRROR", "XDM", "redirecting"];
function extractStreamUrl(url) {
  try {
    const searchParams = new URL(url).searchParams;
    return searchParams.get("url");
  } catch (e) {
    const m = url.match(/url=([^&]*)/);
    if (m)
      return decodeURIComponent(m[1]);
  }
  return null;
}
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    console.log(`[Castle] Starting extraction for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
    const streams = [];
    try {
      const info = yield getTMDBDetails(tmdbId, mediaType);
      console.log(`[Castle] Found: ${info.title} (${info.year})`);
      if (!info.imdbId)
        return [];
      const suffix = mediaType === "movie" ? `movie/${info.imdbId}` : `series/${info.imdbId}:${seasonNum}:${episodeNum}`;
      const url = `${CASTLE_API}/stream/${suffix}.json`;
      const json = yield fetchText(url, { headers: { "Accept": "application/json" } }).then((t) => JSON.parse(t));
      if (!json || !json.streams)
        return [];
      for (const s of json.streams) {
        if (!s.url)
          continue;
        const name = s.name || "";
        const title = s.title || "";
        if (s.url.includes("github.com") || s.url.includes("googleusercontent"))
          continue;
        if (SKIP_PATTERNS.some((p) => name.toLowerCase().includes(p.toLowerCase())))
          continue;
        if (title.toLowerCase().includes("redirecting"))
          continue;
        const streamUrl = extractStreamUrl(s.url);
        if (!streamUrl)
          continue;
        let quality = cleanQuality(name + title, streamUrl);
        if (quality === "Unknown")
          quality = "1080p";
        streams.push({
          name: formatStreamName("Castle", quality, null),
          title: info.title,
          url: streamUrl,
          quality,
          size: "Unknown",
          headers: getStreamHeaders(streamUrl),
          provider: "castle"
        });
      }
      const deduped = deduplicateStreams(streams);
      const sorted = sortStreams(deduped);
      console.log(`[Castle] Total streams found: ${sorted.length}`);
      return sorted;
    } catch (e) {
      console.error(`[Castle] Error: ${e.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
