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

// src/cinemm/index.js
var PROVIDER_NAME = "CineMM";
var MAIN_URL = "https://cinemm.com";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var ACTIONS = {
  search: "6018fac11e9b775fd3a7f877cdc4ab1b312b8e978c",
  quotaReset: "6077a1a88313137459881a82cca9e76114af8993f6",
  movieServers: "401dd7f7ed7453fdfdcc55d28458444ecec9e4cc8d",
  seriesDetails: "40fbf1a13bd851f36bdfb8c1d23835fd1fc16b9ca4",
  episodeServers: "4049901391797f2c009e9c215a59ebc6679aef2e62"
};
var BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "text/x-component",
  "Content-Type": "text/plain;charset=UTF-8",
  "Referer": MAIN_URL + "/"
};
function fetchWithTimeout(url, options, timeout) {
  return __async(this, null, function* () {
    timeout = timeout || 15e3;
    try {
      var merged = options || {};
      if (!merged.headers)
        merged.headers = {};
      if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
        merged.signal = AbortSignal.timeout(timeout);
      }
      return yield fetch(url, merged);
    } catch (e) {
      if (e.name === "AbortError" || e.name === "TimeoutError") {
        throw new Error("[" + PROVIDER_NAME + "] Timeout: " + url.substring(0, 80));
      }
      throw e;
    }
  });
}
function tryExtractJsonValue(body, searchPrefix) {
  var idx = body.indexOf(searchPrefix);
  if (idx === -1)
    return null;
  var startIdx = idx + 2;
  if (startIdx >= body.length)
    return null;
  var firstChar = body[startIdx];
  if (firstChar !== "[" && firstChar !== "{")
    return null;
  var depth = 0, inString = false, escape = false, endIdx = -1;
  for (var i = startIdx; i < body.length; i++) {
    var c = body[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === "[" || c === "{")
        depth++;
      else if (c === "]" || c === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
  }
  if (endIdx === -1)
    return null;
  try {
    return JSON.parse(body.substring(startIdx, endIdx));
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] JSON parse failed: " + e.message);
    return null;
  }
}
function extractCookieFromHeaders(res) {
  try {
    if (res.headers && typeof res.headers.get === "function") {
      var match = (res.headers.get("set-cookie") || "").match(/user_uuid=([^;]+)/);
      if (match)
        return "user_uuid=" + match[1];
    }
    if (res.headers && typeof res.headers.forEach === "function") {
      var found = null;
      res.headers.forEach(function(v, k) {
        if (k.toLowerCase() === "set-cookie" && !found) {
          var m = v.match(/user_uuid=([^;]+)/);
          if (m)
            found = "user_uuid=" + m[1];
        }
      });
      if (found)
        return found;
    }
    if (res.headers && typeof res.headers === "object") {
      var raw = res.headers["set-cookie"] || res.headers["Set-Cookie"] || "";
      if (Array.isArray(raw)) {
        for (var i = 0; i < raw.length; i++) {
          var match = raw[i].match(/user_uuid=([^;]+)/);
          if (match)
            return "user_uuid=" + match[1];
        }
      } else {
        var match = raw.match(/user_uuid=([^;]+)/);
        if (match)
          return "user_uuid=" + match[1];
      }
    }
  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] Cookie extraction error: " + e.message);
  }
  return null;
}
function extractUuidFromBody(body) {
  try {
    var match = body.match(/"uuid":\s*"([a-f0-9-]{36})"/i);
    if (match)
      return "user_uuid=" + match[1];
    var match2 = body.match(/"user_uuid":\s*"([^"]+)"/i);
    if (match2)
      return "user_uuid=" + match2[1];
  } catch (e) {
  }
  return null;
}
function callAction(actionId, bodyData, cookie, referer) {
  return __async(this, null, function* () {
    var headers = {
      "User-Agent": BASE_HEADERS["User-Agent"],
      "Accept": BASE_HEADERS["Accept"],
      "Content-Type": BASE_HEADERS["Content-Type"],
      "next-action": actionId,
      "Referer": referer || MAIN_URL + "/"
    };
    if (cookie)
      headers["Cookie"] = cookie;
    var postBody = typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData);
    var res = yield fetchWithTimeout(MAIN_URL, { method: "POST", headers, body: postBody }, 2e4);
    if (!res.ok)
      throw new Error("Action failed: " + res.status);
    return res;
  });
}
function resetQuota() {
  return __async(this, null, function* () {
    var fingerprint = "";
    var chars = "abcdef0123456789";
    for (var i = 0; i < 32; i++)
      fingerprint += chars[Math.floor(Math.random() * 16)];
    var res = yield callAction(ACTIONS.quotaReset, JSON.stringify([fingerprint, "$undefined"]), null, MAIN_URL + "/");
    var cookie = extractCookieFromHeaders(res);
    if (cookie)
      return cookie;
    try {
      var bodyText = yield res.text();
      var uuidCookie = extractUuidFromBody(bodyText);
      if (uuidCookie)
        return uuidCookie;
    } catch (e) {
    }
    console.error("[" + PROVIDER_NAME + "] No user_uuid found in headers or body");
    return null;
  });
}
function searchCineMM(query, type, cookie) {
  return __async(this, null, function* () {
    var body = JSON.stringify([query, type]);
    var referer = MAIN_URL + "/?search=" + encodeURIComponent(query) + "&type=" + type;
    var res = yield callAction(ACTIONS.search, body, cookie, referer);
    var rscBody = yield res.text();
    var data = tryExtractJsonValue(rscBody, "1:[");
    if (!data || !Array.isArray(data)) {
      console.log("[" + PROVIDER_NAME + "] Search returned no results");
      return [];
    }
    console.log("[" + PROVIDER_NAME + "] Search found " + data.length + " results");
    return data;
  });
}
function getMovieServers(cineMMId, cookie) {
  return __async(this, null, function* () {
    var body = JSON.stringify([[cineMMId]]);
    var res = yield callAction(ACTIONS.movieServers, body, cookie, MAIN_URL + "/");
    var rscBody = yield res.text();
    var data = tryExtractJsonValue(rscBody, '1:{"servers"');
    if (!data || !data.servers) {
      console.error("[" + PROVIDER_NAME + "] Movie servers: no data");
      return null;
    }
    console.log("[" + PROVIDER_NAME + "] Movie servers: " + data.servers.length + " sources");
    return data;
  });
}
function getSeriesDetails(cineMMId, cookie) {
  return __async(this, null, function* () {
    var body = JSON.stringify([[cineMMId]]);
    var res = yield callAction(ACTIONS.seriesDetails, body, cookie, MAIN_URL + "/");
    var rscBody = yield res.text();
    var data = tryExtractJsonValue(rscBody, '1:{"seasons"');
    if (!data || !data.seasons) {
      console.error("[" + PROVIDER_NAME + "] Series details: no data");
      return null;
    }
    console.log("[" + PROVIDER_NAME + "] Series has " + data.seasons.length + " seasons");
    return data;
  });
}
function getEpisodeServers(episodeId, cookie) {
  return __async(this, null, function* () {
    var body = JSON.stringify([[episodeId]]);
    var res = yield callAction(ACTIONS.episodeServers, body, cookie, MAIN_URL + "/");
    var rscBody = yield res.text();
    var data = tryExtractJsonValue(rscBody, '1:{"servers"');
    if (!data || !data.servers) {
      console.error("[" + PROVIDER_NAME + "] Episode servers: no data");
      return null;
    }
    console.log("[" + PROVIDER_NAME + "] Episode servers: " + data.servers.length + " sources");
    return data;
  });
}
function getTMDBInfo(id, type) {
  return __async(this, null, function* () {
    var idStr = String(id).trim();
    var isImdbId = idStr.startsWith("tt");
    var isNumericId = /^\d+$/.test(idStr);
    var tmdbType = type === "tv" || type === "series" ? "tv" : "movie";
    var apiType = tmdbType === "tv" ? "series" : "movie";
    try {
      if (isImdbId) {
        console.log("[" + PROVIDER_NAME + "] Mobile ID detected (" + idStr + "). Resolving via TMDB...");
        var res = yield fetchWithTimeout(
          "https://api.themoviedb.org/3/find/" + idStr + "?api_key=" + TMDB_API_KEY + "&external_source=imdb_id",
          { headers: { "User-Agent": BASE_HEADERS["User-Agent"] } }
        );
        if (res.ok) {
          var data = yield res.json();
          var results = tmdbType === "tv" ? data.tv_results : data.movie_results;
          if (results && results.length > 0) {
            var item = results[0];
            return { id: item.id, title: tmdbType === "tv" ? item.name : item.title, year: (item.first_air_date || item.release_date || "").split("-")[0], type: apiType };
          }
        }
        console.log("[" + PROVIDER_NAME + "] TMDB find failed, trying Cinemeta...");
        var cRes = yield fetchWithTimeout("https://v3-cinemeta.strem.io/meta/" + apiType + "/" + idStr + ".json", { headers: { "User-Agent": BASE_HEADERS["User-Agent"] } });
        if (cRes.ok) {
          var cData = yield cRes.json();
          if (cData.meta)
            return { id: idStr, title: cData.meta.name || cData.meta.title || idStr, year: cData.meta.year || (cData.meta.released || "").split("-")[0], type: apiType };
        }
        return { id: idStr, title: idStr, year: null, type: apiType };
      } else if (isNumericId) {
        var res = yield fetchWithTimeout("https://api.themoviedb.org/3/" + tmdbType + "/" + idStr + "?api_key=" + TMDB_API_KEY, { headers: { "User-Agent": BASE_HEADERS["User-Agent"] } });
        if (res.ok) {
          var data = yield res.json();
          return { id: data.id, title: tmdbType === "tv" ? data.name : data.title, year: (data.first_air_date || data.release_date || "").split("-")[0], type: apiType };
        }
        return { id: idStr, title: idStr, year: null, type: apiType };
      } else {
        return { id: idStr, title: idStr, year: null, type: apiType };
      }
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] TMDB error: " + e.message);
      return { id: idStr, title: String(idStr), year: null, type: apiType };
    }
  });
}
function similarity(s1, s2, year) {
  if (!s1 || !s2)
    return 0;
  var clean = function(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  };
  var w1 = clean(s1);
  var w2Set = {};
  var w2Arr = clean(s2);
  for (var i = 0; i < w2Arr.length; i++)
    w2Set[w2Arr[i]] = true;
  var intersection = 0;
  for (var i = 0; i < w1.length; i++) {
    if (w2Set[w1[i]])
      intersection++;
  }
  var score = intersection / Math.max(w1.length, 1);
  if (year && String(s2).includes(String(year)))
    score += 0.25;
  if (s2.toLowerCase().startsWith(s1.toLowerCase()))
    score += 0.15;
  return Math.min(score, 1);
}
function normalizeQuality(text) {
  var t = String(text || "").toLowerCase();
  if (t.includes("2160") || t.includes("4k") || t.includes("uhd"))
    return "2160p";
  if (t.includes("1440"))
    return "1440p";
  if (t.includes("1080"))
    return "1080p";
  if (t.includes("720"))
    return "720p";
  if (t.includes("480"))
    return "480p";
  if (t.includes("360"))
    return "360p";
  return "HD";
}
function buildStreamsFromServers(servers) {
  if (!servers || !Array.isArray(servers))
    return [];
  var seen = {}, streams = [];
  for (var i = 0; i < servers.length; i++) {
    var s = servers[i];
    if (!s || !s.url || seen[s.url])
      continue;
    seen[s.url] = true;
    var quality = normalizeQuality(s.name || "");
    var sizeLabel = s.size ? " (" + s.size + ")" : "";
    streams.push({
      name: PROVIDER_NAME + " | " + quality + sizeLabel,
      title: (s.name || "CineMM") + "\n" + quality + " \xB7 MP4\nby CineMM",
      url: s.url,
      quality,
      headers: { "Referer": MAIN_URL + "/", "User-Agent": BASE_HEADERS["User-Agent"] }
    });
  }
  return streams;
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[" + PROVIDER_NAME + "] Request: ID=" + tmdbId + ", Type=" + mediaType + ", S=" + season + ", E=" + episode);
      var isTv = mediaType === "tv" || mediaType === "series";
      var cineMMType = isTv ? "series" : "movie";
      var media = yield getTMDBInfo(tmdbId, mediaType);
      if (!media || !media.title) {
        console.log("[" + PROVIDER_NAME + "] Could not resolve media info");
        return [];
      }
      console.log("[" + PROVIDER_NAME + '] Resolved: "' + media.title + '" (' + (media.year || "N/A") + ")");
      var cookie = yield resetQuota();
      if (!cookie) {
        console.log("[" + PROVIDER_NAME + "] Quota reset failed");
        return [];
      }
      var searchResults = yield searchCineMM(media.title, cineMMType, cookie);
      if (!searchResults || searchResults.length === 0) {
        console.log("[" + PROVIDER_NAME + "] No results for: " + media.title);
        return [];
      }
      var bestMatch = null, bestScore = 0;
      for (var i = 0; i < searchResults.length; i++) {
        var r = searchResults[i];
        var score = similarity(media.title, r.name, media.year);
        var shortTitle = media.title.split(" ").length <= 3;
        if (shortTitle && media.year && r.year && Math.abs(parseInt(media.year) - parseInt(r.year)) > 2)
          score -= 0.5;
        if (score > bestScore && score >= 0.4) {
          bestScore = score;
          bestMatch = r;
        }
      }
      if (!bestMatch) {
        console.log("[" + PROVIDER_NAME + "] No match (best=" + bestScore.toFixed(2) + ")");
        return [];
      }
      console.log("[" + PROVIDER_NAME + '] Match: "' + bestMatch.name + '" (ID: ' + bestMatch.id + ", score: " + bestScore.toFixed(2) + ")");
      var cineMMId = bestMatch.id;
      var streams = [];
      if (isTv) {
        var seriesData = yield getSeriesDetails(cineMMId, cookie);
        if (!seriesData || !seriesData.seasons) {
          console.log("[" + PROVIDER_NAME + "] No series details");
          return [];
        }
        var targetSeasonId = null;
        for (var s = 0; s < seriesData.seasons.length; s++) {
          var sn = seriesData.seasons[s].name.match(/(\d+)/);
          if (sn && parseInt(sn[1]) === parseInt(season)) {
            targetSeasonId = seriesData.seasons[s].id;
            break;
          }
        }
        if (!targetSeasonId) {
          var si = parseInt(season) - 1;
          if (si >= 0 && si < seriesData.seasons.length)
            targetSeasonId = seriesData.seasons[si].id;
        }
        if (!targetSeasonId) {
          console.log("[" + PROVIDER_NAME + "] Season " + season + " not found");
          return [];
        }
        var targetSeason = null;
        for (var s = 0; s < seriesData.seasons.length; s++) {
          if (seriesData.seasons[s].id === targetSeasonId) {
            targetSeason = seriesData.seasons[s];
            break;
          }
        }
        if (!targetSeason || !targetSeason.episodes || targetSeason.episodes.length === 0) {
          console.log("[" + PROVIDER_NAME + "] No episodes for season " + season);
          return [];
        }
        var targetEpId = null;
        for (var e = 0; e < targetSeason.episodes.length; e++) {
          if (targetSeason.episodes[e].episode_number === parseInt(episode)) {
            targetEpId = targetSeason.episodes[e].id;
            break;
          }
        }
        if (!targetEpId) {
          var ei = parseInt(episode) - 1;
          if (ei >= 0 && ei < targetSeason.episodes.length)
            targetEpId = targetSeason.episodes[ei].id;
        }
        if (!targetEpId) {
          console.log("[" + PROVIDER_NAME + "] Episode " + episode + " not found");
          return [];
        }
        console.log("[" + PROVIDER_NAME + "] Fetching episode " + targetEpId + " (S" + season + "E" + episode + ")");
        var epData = yield getEpisodeServers(targetEpId, cookie);
        if (epData && epData.servers)
          streams = buildStreamsFromServers(epData.servers);
      } else {
        var movieData = yield getMovieServers(cineMMId, cookie);
        if (movieData && movieData.servers)
          streams = buildStreamsFromServers(movieData.servers);
      }
      console.log("[" + PROVIDER_NAME + "] Returning " + streams.length + " streams");
      return streams;
    } catch (e2) {
      console.error("[" + PROVIDER_NAME + "] Error: " + e2.message);
      return [];
    }
  });
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
