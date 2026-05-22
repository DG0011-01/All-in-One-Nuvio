// moviesdrive provider
// scrapes new2.moviesdrives.my

const cheerio = require('cheerio-without-node-native');

// config
var PROVIDER   = "MoviesDrive";
var MAIN_URL   = "https://new2.moviesdrives.my";
var ARCHIVE    = "https://mdrive.lol";
var TMDB_KEY   = "439c478a771f35c05022f9feabcca01c";

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

var BASE_HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5"
};

// utils
function log(msg) { console.log("[" + PROVIDER + "] " + msg); }
function err(msg) { console.error("[" + PROVIDER + "] " + msg); }

// safe fetch with timeout
async function get(url, opts, timeout) {
  timeout = timeout || 12000;
  try {
    var sig = null;
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout)
      sig = AbortSignal.timeout(timeout);
    var hdrs = {};
    for (var k in BASE_HEADERS) hdrs[k] = BASE_HEADERS[k];
    if (opts && opts.headers) {
      for (var k2 in opts.headers) hdrs[k2] = opts.headers[k2];
    }
    var merged = { ...(opts || {}), headers: hdrs };
    if (sig) merged.signal = sig;
    return await fetch(url, merged);
  } catch (e) {
    err("fetch: " + url.substring(0, 80) + " -> " + (e.message || e.name || 'unknown'));
    return null;
  }
}

async function getText(url, opts, timeout) {
  var r = await get(url, opts, timeout);
  if (!r) { err("text: null response for " + url.substring(0, 80)); return null; }
  if (!r.ok) { err("text: status " + r.status + " for " + url.substring(0, 80)); return null; }
  return await r.text();
}

async function getJson(url, opts, timeout) {
  var t = await getText(url, opts, timeout);
  if (!t) return null;
  try { return JSON.parse(t); } catch(e) { return null; }
}

async function getHtml(url, opts, timeout) {
  var t = await getText(url, opts, timeout);
  if (!t) { err("html: no text for " + url.substring(0, 80)); return null; }
  return cheerio.load(t);
}

// url resolve fallback
function resolveUrl(base, rel) {
  if (!rel) return base;
  if (rel.indexOf('http://') === 0 || rel.indexOf('https://') === 0) return rel;
  if (rel.indexOf('//') === 0) return 'https:' + rel;
  if (rel.indexOf('/') === 0) {
    var parts = base.split('//');
    return parts[0] + '//' + parts[1].split('/')[0] + rel;
  }
  var idx = base.lastIndexOf('/');
  return (idx > 8 ? base.substring(0, idx) : base) + '/' + rel;
}

function getOrigin(u) {
  var p = u.split('//');
  if (p.length < 2) return u;
  return p[0] + '//' + p[1].split('/')[0];
}

// quality from label text
function parseQ(t) {
  t = (t || '').toUpperCase();
  if (t.indexOf('2160') >= 0 || t.indexOf('4K') >= 0) return '2160p';
  if (t.indexOf('1080') >= 0) return '1080p';
  if (t.indexOf('720') >= 0) return '720p';
  if (t.indexOf('480') >= 0) return '480p';
  return 'HD';
}

// score title similarity for search matching
function similar(s1, s2, year, isTv) {
  if (!s1 || !s2) return 0;
  var c = function(s) { return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean); };
  var w1 = c(s1);
  var w2 = c(s2);
  
  // exact matching: the first w1.length words of w2 MUST exactly match w1
  if (w2.length < w1.length) return 0;
  for (var i = 0; i < w1.length; i++) {
    if (w1[i] !== w2[i]) return 0; // Not an exact title match
  }
  
  var score = 0.8;
  
  if (year) {
    var ym = s2.match(/\b(19|20)\d{2}\b/);
    if (ym) {
      if (Math.abs(parseInt(ym[0]) - parseInt(year)) <= 1) {
         score += 0.2; // Year matches perfectly (or off by 1)
      } else {
         return 0; // Year mismatch, reject!
      }
    }
  }
  
  return score;
}

// dedupe by url
function dedupe(arr) {
  var seen = {};
  return (arr || []).filter(function(s) {
    if (!s || !s.url || seen[s.url]) return false;
    seen[s.url] = true;
    return true;
  });
}

// format stream object
function makeStream(name, label, url, quality, hdrs) {
  return {
    name: PROVIDER + " | " + name,
    title: label,
    url: url,
    quality: quality,
    headers: hdrs || {}
  };
}

// get info from tmdb

async function getMedia(id, type) {
  var s = String(id || '').trim();
  var isImdb = s.indexOf('tt') === 0;
  var t = (type === 'tv' || type === 'series') ? 'tv' : 'movie';

  // if numeric, use /tv/ID or /movie/ID endpoint
  // if imdb, use /find endpoint
  try {
    if (isImdb) {
      var data = await getJson('https://api.themoviedb.org/3/find/' + s + '?api_key=' + TMDB_KEY + '&external_source=imdb_id', {}, 10000);
      var list = data ? (t === 'tv' ? data.tv_results : data.movie_results) : null;
      if (list && list.length > 0) {
        var it = list[0];
        return {
          title: t === 'tv' ? it.name : it.title,
          year: (it.first_air_date || it.release_date || '').split('-')[0],
          imdb: s
        };
      }
    } else {
      var data = await getJson('https://api.themoviedb.org/3/' + t + '/' + s + '?api_key=' + TMDB_KEY + '&append_to_response=external_ids', {}, 10000);
      if (data) {
        return {
          title: t === 'tv' ? data.name : data.title,
          year: (data.first_air_date || data.release_date || '').split('-')[0],
          imdb: data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null
        };
      }
    }
  } catch(e) { err("tmdb: " + e.message); }
  return { title: s, year: null, imdb: null };
}

// hit the site's typesense search api

async function searchSite(query) {
  var q = encodeURIComponent(query);
  var url = MAIN_URL + '/search.php?q=' + q + '&per_page=10';
  var data = await getJson(url, {
    headers: { 'Referer': MAIN_URL + '/' }
  }, 10000);
  if (!data || !data.hits || data.hits.length === 0) {
    log("search zero results for '" + query + "'");
    return [];
  }
  var out = [];
  for (var i = 0; i < data.hits.length; i++) {
    var doc = data.hits[i].document;
    if (doc && doc.permalink && doc.post_title) {
      var ym = doc.post_title.match(/\((\d{4})\)/);
      out.push({
        title: doc.post_title,
        href: doc.permalink,
        year: ym ? parseInt(ym[0]) : null,
        imdb: doc.imdb_id || null
      });
    }
  }
  log("search found " + out.length + " results for '" + query + "'");
  return out;
}

// scrape archive links from the main post page

async function parsePage(url, season) {
  log("parsing page: " + url);
  var $ = await getHtml(url, { headers: { 'Referer': MAIN_URL + '/' } }, 12000);
  if (!$) return [];
  var links = [];
  var isTv = (season != null);

  // filter by season for tv shows
  if (isTv) {
    // the page has h5 elements like "Season 5" followed by quality links
    var inSeason = false;
    $('h5').each(function(i, el) {
      var txt = $(el).text();
      var sm = txt.match(/Season\s+(\d+)/i);
      if (sm) {
        inSeason = (parseInt(sm[1]) === season);
        return;
      }
      if (inSeason) {
        $(el).find('a[href*="mdrive.lol/archive/"]').each(function() {
          var href = $(this).attr('href');
          var label = $(this).text().trim();
          if (!href || label.toLowerCase().indexOf('zip') >= 0) return;
          var mid = href.match(/archive\/(\d+)/);
          if (mid) links.push({ id: mid[1], url: href, label: label, q: parseQ(label) });
        });
      }
    });
  }

  // grab any loose archive links if section parsing failed
  if (links.length === 0) {
    $('a[href*="mdrive.lol/archive/"], a[href*="mdrive.lol/"]').each(function(i, el) {
      var href = $(el).attr('href');
      var label = $(el).text().trim() || 'HD';
      if (label.toLowerCase().indexOf('zip') >= 0 && isTv) return;
      var mid = href.match(/archive\/(\d+)/);
      if (mid) links.push({ id: mid[1], url: href, label: label, q: parseQ(label) });
    });
  }

  // regex the raw html just in case
  if (links.length === 0) {
    var bodyHtml = $.html();
    var bodyMatches = bodyHtml.match(/https?:\/\/mdrive\.lol\/archive\/(\d+)/g);
    if (bodyMatches) {
      var seen = {};
      for (var bi = 0; bi < bodyMatches.length; bi++) {
        var murl = bodyMatches[bi];
        if (seen[murl]) continue;
        seen[murl] = true;
        var mid = murl.match(/archive\/(\d+)/);
        if (mid) {
          var lbl = 'Archive ' + mid[1];
          links.push({ id: mid[1], url: murl, label: lbl, q: 'HD' });
        }
      }
    }
  }

  // check for search-recover links (some new movies use these instead of archives)
  if (links.length === 0) {
    var srLinks = [];
    $('a').each(function(i, el) {
      var href = $(el).attr('href');
      if (!href) return;
      if (href.indexOf('search-recover.php') >= 0) {
        // deduplicate by URL
        var dup = false;
        for (var di = 0; di < srLinks.length; di++) { if (srLinks[di].url === href) { dup = true; break; } }
        if (!dup) {
          var txt = $(el).text().trim() || 'HD';
          srLinks.push({ url: href, label: txt });
        }
      }
    });
    if (srLinks.length > 0) {
      log("page: found " + srLinks.length + " search-recover links, resolving...");
      var sTasks = [];
      for (var si = 0; si < srLinks.length; si++) {
        sTasks.push(resolveSearchRecover(srLinks[si].url, srLinks[si].label));
      }
      var sResults = await Promise.all(sTasks);
      for (var si = 0; si < sResults.length; si++) {
        if (sResults[si]) {
          links.push({
            url: sResults[si].url,
            label: sResults[si].label || 'search-recover',
            q: sResults[si].q || parseQ(sResults[si].label || ''),
            type: 'direct'  // skip parseArchive, go straight to resolveHubcloud
          });
        }
      }
      log("page: resolved " + links.length + " drive links from search-recover");
    }
  }

  log("page: found " + links.length + " archive links");
  return links;
}

// resolve search-recover links into drive links

async function resolveSearchRecover(srUrl, label) {
  try {
    // safety: decode &amp; → & if cheerio didn't already (Ksoup quirk)
    srUrl = srUrl.replace(/&amp;/g, '&');

    // extract from_ac and q param from url
    var fromAc = null;
    var fa = srUrl.match(/[?&]from_ac=([a-zA-Z0-9_\-]+)/);
    if (fa) fromAc = fa[1];
    var qParam = null;
    var qm = srUrl.match(/[?&]q=([^&]+)/);
    if (qm) qParam = qm[1];
    if (!fromAc || !qParam) { log("search-recover: missing from_ac or q"); return null; }

    // q param is typically base64-encoded (e.g. "R09BVCAyMDI2IDIxNjBw" = "GOAT 2026 2160p")
    var decodedQ = qParam;
    try {
        var padded = qParam;
        var m = padded.length % 4;
        if (m === 2) padded += '==';
        else if (m === 3) padded += '=';
        decodedQ = atob(padded);
    } catch (e) { /* not base64, use raw */ }

    // build JSON API URL
    var baseUrl = srUrl.split('?')[0];
    var apiUrl = baseUrl + '?api=search&q=' + encodeURIComponent(decodedQ) + '&page=1&from_ac=' + encodeURIComponent(fromAc);
    log("search-recover: api call for '" + decodedQ + "'");

    var res = await getText(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Referer': srUrl,
        'User-Agent': UA
      }
    }, 12000);
    if (!res) { log("search-recover: no response"); return null; }

    // parse json — could be root array or wrapped in {data: [...]}
    var results = null;
    try {
      var parsed = JSON.parse(res);
      if (Array.isArray(parsed)) results = parsed;
      else if (parsed.data && Array.isArray(parsed.data)) results = parsed.data;
      else if (parsed.results && Array.isArray(parsed.results)) results = parsed.results;
      else if (parsed.hits) results = parsed.hits;
    } catch (e) {
      log("search-recover: json parse failed, trying raw url");
      var res2 = await getText(srUrl, {
        headers: {
          'Accept': 'application/json',
          'Referer': srUrl,
          'User-Agent': UA
        }
      }, 12000);
      if (res2) {
        try { var parsed2 = JSON.parse(res2);
          if (Array.isArray(parsed2)) results = parsed2;
          else if (parsed2.data && Array.isArray(parsed2.data)) results = parsed2.data;
          else if (parsed2.results && Array.isArray(parsed2.results)) results = parsed2.results;
        } catch (e2) {}
      }
    }

    if (!results || results.length === 0) {
      log("search-recover: no results");
      return null;
    }

    // pick first result with a drive url
    for (var ri = 0; ri < results.length; ri++) {
      var doc = results[ri].document || results[ri];
      var driveUrl = doc.url || doc.link || doc.drive;
      if (driveUrl && driveUrl.indexOf('/drive/') >= 0) {
        log("search-recover: resolved to " + driveUrl.substring(0, 50));
        var q = parseQ(label || '');
        return { url: driveUrl, label: label, q: q || 'HD' };
      }
    }

    log("search-recover: no drive url in results");
    return null;
  } catch (e) {
    err("search-recover: " + e.message);
    return null;
  }
}

// parse the mdrive archive pages for host links

async function parseArchive(url, episode) {
  log("archive: " + url);
  var $ = await getHtml(url, { headers: { 'Referer': MAIN_URL + '/' } }, 12000);
  if (!$) { err("archive: html null for " + url.substring(0, 60)); return []; }

  var htmlLen = ($.html() || '').length;
  log("archive: html length=" + htmlLen);

  var hosts = [];
  var isEp = (episode != null);

  // iterate a tags manually (ksoup cheerio has limited selector support)
  var totalLinks = 0;
  $('a').each(function(i, el) {
    totalLinks++;
    var h = $(el).attr('href');
    if (!h) return;
    if (isHostLink(h)) extractHostLink(h, hosts);
  });
  log("archive: scanned " + totalLinks + " <a> tags, found " + hosts.length + " hoster links");

  // scan raw html if no a tags found
  if (hosts.length === 0 && htmlLen > 200) {
    log("archive: scanning raw HTML for hubcloud/gdflix patterns");
    var raw = $.html() || '';
    // match hubcloud.*/drive/ID
    var hcMatches = raw.match(/https?:\/\/hubcloud\.[a-z]+\/drive\/[a-z0-9]+/g);
    if (hcMatches) {
      for (var hi = 0; hi < hcMatches.length; hi++) {
        var u = hcMatches[hi];
        var dup = false;
        for (var di = 0; di < hosts.length; di++) { if (hosts[di].url === u) { dup = true; break; } }
        if (!dup) {
          var idm = u.match(/drive\/([a-z0-9]+)/);
          if (idm) hosts.push({ type: 'hubcloud', url: u, id: idm[1] });
        }
      }
    }
    // match gdflix.*/file/ID
    var gfMatches = raw.match(/https?:\/\/gdflix\.[a-z]+\/file\/[a-zA-Z0-9]+/g);
    if (gfMatches) {
      for (var gi = 0; gi < gfMatches.length; gi++) {
        var u = gfMatches[gi];
        var dup = false;
        for (var di = 0; di < hosts.length; di++) { if (hosts[di].url === u) { dup = true; break; } }
        if (!dup) {
          var idm = u.match(/file\/([a-zA-Z0-9]+)/);
          if (idm) hosts.push({ type: 'gdflix', url: u, id: idm[1] });
        }
      }
    }
  }

  log("archive: returning " + hosts.length + " hosts");
  return hosts;
}

// check if an href is a hoster link (hubcloud or gdflix)
function isHostLink(href) {
  if (!href) return false;
  return href.indexOf('hubcloud.') >= 0 || href.indexOf('gdflix.') >= 0;
}

// extract hubcloud or gdflix link from href — handles multiple domain variants
function extractHostLink(href, arr) {
  if (!href || !arr) return;
  // hubcloud: hubcloud.foo, hubcloud.one, hubcloud.cx, etc.
  var hm = href.match(/(?:hubcloud\.[a-z]+\/drive\/([a-z0-9]+))/i);
  if (hm) {
    for (var di = 0; di < arr.length; di++) { if (arr[di].url === href) return; }
    arr.push({ type: 'hubcloud', url: href, id: hm[1] });
    return;
  }
  // gdflix: gdflix.dev, gdflix.top, etc.
  var gm = href.match(/(?:gdflix\.[a-z]+\/file\/([a-zA-Z0-9]+))/i);
  if (gm) {
    for (var di = 0; di < arr.length; di++) { if (arr[di].url === href) return; }
    arr.push({ type: 'gdflix', url: href, id: gm[1] });
    return;
  }
}

// handle hubcloud links to extract the final fsl stream

function minutes() {
  var d = new Date();
  return String(d.getMinutes());
}

async function resolveHubcloud(url, label) {
  try {
    log("hubcloud: " + url.substring(0, 60));

    // step 1: fetch landing page with cookie
    var html = await getText(url, {
      headers: {
        'Referer': 'https://hubcloud.foo/',
        'Cookie': 'xla=s4t'
      }
    }, 12000);
    if (!html) return [];

    // step 2: extract gamerxyt bridge url from var url = '...'
    var bridgeUrl = null;
    var vm = html.match(/var\s+url\s*=\s*'([^']+)'/);
    if (vm) bridgeUrl = vm[1];
    if (!bridgeUrl) {
      var hm = html.match(/<a[^>]*id=["']download["'][^>]*href=["']([^"']+)["']/);
      if (hm) bridgeUrl = hm[1];
    }
    if (!bridgeUrl) {
      log("hubcloud: no bridge url found");
      return [];
    }

    log("hubcloud: bridge=" + bridgeUrl.substring(0, 60));

    // step 3: fetch bridge page — friend confirmed it's accessible (no cloudflare block)
    var bridgeHtml = await getText(bridgeUrl, {
      headers: {
        'Referer': url,
        'Cookie': 'xla=s4t'
      }
    }, 15000);
    if (!bridgeHtml) return [];

    // get fsl url and append minutes token if needed
    var fslUrl = null;
    var tm = bridgeHtml.match(/https?:\/\/[^\s"'<>]+\?token=\d+/);
    if (tm) {
        var mUrl = tm[0].replace(/["'].*$/, '').replace(/[<>].*$/, '');
        if (mUrl.indexOf('hubcloud.php') === -1) {
            fslUrl = mUrl + '1' + minutes();
        }
    }
    if (!fslUrl) {
        var r2m = bridgeHtml.match(/https?:\/\/pub-[a-zA-Z0-9\-]+\.r2\.dev[^\s"'<>]*/);
        if (r2m) {
            fslUrl = r2m[0].replace(/["'].*$/, '').replace(/[<>].*$/, '');
        }
    }

    var streams = [];
    if (fslUrl) {
      var q = parseQ(label);
      log("hubcloud: fsl found (" + q + ")");
      streams.push(makeStream('FSL | ' + q, label + ' [FSL]', fslUrl, q, {
        'Referer': 'https://gamerxyt.com/',
        'Origin': 'https://gamerxyt.com/',
        'User-Agent': UA
      }));
    }

    log("hubcloud: returning " + streams.length + " streams");
    return streams;

    log("hubcloud: returning " + streams.length + " streams");
    return streams;
  } catch (e) {
    err("hubcloud: " + e.message);
    return [];
  }
}

// main entry point

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    log("request: id=" + tmdbId + " type=" + mediaType + " s=" + season + " e=" + episode);

    var info = await getMedia(tmdbId, mediaType);
    if (!info || !info.title) {
      log("no media info resolved, returning []");
      return [];
    }
    var isTv = (mediaType === 'tv' || mediaType === 'series');
    log("resolved: \"" + info.title + "\" (" + (info.year || '?') + ")");

    var safeSeason = (season != null) ? Number(season) : null;
    var safeEpisode = (episode != null) ? Number(episode) : null;

    // search site
    var results = await searchSite(info.title);
    if (results.length === 0 && info.year) {
      results = await searchSite(info.title + ' ' + info.year);
    }
    if (results.length === 0 && info.imdb) {
      results = await searchSite(info.imdb);
    }

    // find best match: priority 1 = IMDB ID match, priority 2 = title similarity
    var best = null, bestScore = 0;

    // priority 1: IMDB ID match (most reliable when available)
    if (info.imdb) {
      for (var i = 0; i < results.length; i++) {
        if (results[i].imdb === info.imdb) {
          best = results[i];
          bestScore = 1.0;
          log("imdb match: " + best.title + " (id=" + info.imdb + ")");
          break;
        }
      }
    }

    // priority 2: title similarity
    if (!best) {
      for (var i = 0; i < results.length; i++) {
        var score = similar(info.title, results[i].title, info.year, isTv);
        if (score > bestScore) { bestScore = score; best = results[i]; }
      }
      log("title match: " + (best ? best.title + ' (score=' + bestScore.toFixed(2) + ')' : 'none'));
    }

    if (!best || bestScore < 0.4) {
      log("no confident match, returning []");
      return [];
    }

    // parse page for archive links
    var pageUrl = MAIN_URL + best.href;
    var archLinks = await parsePage(pageUrl, safeSeason);
    if (archLinks.length === 0) {
      log("no archive links found on page, returning []");
      return [];
    }

    // keep only 720p, 1080p, 2160p — drop 480p and others for speed
    archLinks = archLinks.filter(function(al) {
      return al.q === '720p' || al.q === '1080p' || al.q === '2160p';
    });
    if (archLinks.length === 0) {
      log("no 720p/1080p/2160p links found, returning []");
      return [];
    }
    log("keeping " + archLinks.length + " archive links (720p/1080p/2160p only)");

    // helper to pad numbers
    function pad2(n) { return (n != null && n < 10) ? '0' + n : String(n); }
    var epLabel = isTv ? ' S' + pad2(safeSeason) + ' E' + pad2(safeEpisode) : '';
    
    // for each archive link, fetch archive page and resolve hosts
    // process hubcloud and gdflix links in PARALLEL for speed
    var allStreams = [];
    archLinks.forEach(function(al) {
      var task = async function() {
        try {
          var hcHosts = [];
          var gfHosts = [];
          if (al.type === 'direct') {
            hcHosts.push({ url: al.url, type: 'hubcloud' });
          } else {
            var hosts = await parseArchive(al.url, safeEpisode);
            hcHosts = hosts.filter(function(h) { return h.type === 'hubcloud'; });
          }
          if (hcHosts.length === 0) return [];

          var fullTitle = info.title + epLabel + ' ' + al.q;
          var hcTasks = hcHosts.map(function(h) { return resolveHubcloud(h.url, fullTitle); });
          
          var hcResults = await Promise.all(hcTasks);
          
          var allStreamsOut = [];
          hcResults.forEach(function(arr) { arr.forEach(function(s) { allStreamsOut.push(s); }); });
          return allStreamsOut;
        } catch(e) { return []; }
      };
      allStreams.push(task());
    });

    var resolved = await Promise.all(allStreams);
    var flat = [];
    resolved.forEach(function(arr) {
      arr.forEach(function(s) { flat.push(s); });
    });

    // If we got streams from ANY archive, return them
    var finalStreams = dedupe(flat);
    log("returning " + finalStreams.length + " streams");
    return finalStreams;
  } catch (e) {
    err("fatal: " + e.message);
    return [];
  }
}

// ─── EXPORTS ─────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams }; }
else { global.getStreams = getStreams; }
