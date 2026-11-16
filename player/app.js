/**
 * 气象万千 · 天气预报表在线播放器
 * 自动读取最新 m3u，零依赖、无广告。
 */
(function () {
  'use strict';

  var Parser = window.PlaylistParser;
  if (!Parser) {
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">播放器脚本加载失败：找不到 playlist.js。</p>';
    return;
  }

  var REPO_SLUG = 'AndrewGoal/cctv_weather_forecasting_m3u';
  var RELEASE_URL = 'https://github.com/' + REPO_SLUG + '/releases/latest/download/cctv_weather_forecasting.m3u';
  var CACHE_KEY = 'cwp:playlist:v1';
  var AUTONEXT_KEY = 'cwp:autonext';
  var DEFAULT_REFRESH_MIN = 30;

  var params = new URLSearchParams(location.search);
  var embed = params.get('embed') === '1' || params.get('embed') === 'true' || params.get('chrome') === '0';
  if (embed) document.body.classList.add('embed');

  var refreshMinutes = clamp(parseInt(params.get('refresh'), 10) || DEFAULT_REFRESH_MIN, 1, 720);
  var refreshMs = refreshMinutes * 60 * 1000;
  var customSource = params.get('m3u');
  var autoplayParam = params.get('autoplay');
  // 默认打开即自动播放；?autoplay=0 关闭，?autoplay=muted 直接静音自动播放
  var autoplayEnabled = autoplayParam !== '0' && autoplayParam !== 'false';
  var forceMutedAutoplay = autoplayParam === 'muted';

  var state = {
    items: [],
    groups: [],
    visible: [],
    rendered: [],
    current: null,
    filterGroup: null,
    query: '',
    autoNext: readAutoNext(),
    source: null,
    fileTime: null,
    loadedAt: 0,
    hash: '',
    loading: false,
    firstLoad: true,
    triedOriginal: false,
    mutedForAutoplay: false,
    isHls: false,
    live: false,
    triedHlsProbe: false
  };

  /* ---------- DOM ---------- */

  var $ = function (id) { return document.getElementById(id); };
  var video = $('video');
  var hls = null;
  var slowNotice = false;
  var nativeHls = !!(video.canPlayType('application/vnd.apple.mpegurl'));
  var overlay = $('overlay');
  var overlayTitle = $('overlayTitle');
  var overlayHint = $('overlayHint');
  var bigPlay = $('bigPlay');
  var soundPrompt = $('soundPrompt');
  var playerBadge = $('playerBadge');
  var statusEl = $('status');
  var statusText = $('statusText');
  var refreshBtn = $('refreshBtn');
  var searchInput = $('search');
  var chipsEl = $('chips');
  var listEl = $('list');
  var listMeta = $('listMeta');
  var clearFilterBtn = $('clearFilter');
  var nowTitle = $('nowTitle');
  var nowGroup = $('nowGroup');
  var nowTime = $('nowTime');
  var nowDuration = $('nowDuration');
  var nowMeta = $('nowMeta');
  var prevBtn = $('prevBtn');
  var nextBtn = $('nextBtn');
  var autoNextInput = $('autoNext');
  var moreBtn = $('moreBtn');
  var moreMenu = $('moreMenu');
  var copyBtn = $('copyBtn');
  var openBtn = $('openBtn');
  var shareBtn = $('shareBtn');
  var downloadLink = $('downloadLink');
  var sourceLink = $('sourceLink');
  var noticeEl = $('notice');
  var noticeText = $('noticeText');
  var noticeAction = $('noticeAction');
  var toastEl = $('toast');

  autoNextInput.checked = state.autoNext;

  /* ---------- 工具函数 ---------- */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isTypingTarget(target) {
    if (!target) return false;
    var tag = target.tagName || '';
    return tag === 'INPUT' || tag === 'TEXTAREA' || !!target.isContentEditable;
  }

  function readAutoNext() {
    try {
      return localStorage.getItem(AUTONEXT_KEY) !== '0';
    } catch (err) {
      return true;
    }
  }

  function saveAutoNext(value) {
    try {
      localStorage.setItem(AUTONEXT_KEY, value ? '1' : '0');
    } catch (err) { /* 隐私模式下忽略 */ }
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  // 节目时间均为北京时间，跨时区访问时也按北京时间展示
  function beijingParts(timestamp) {
    var parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(timestamp));
    var result = {};
    parts.forEach(function (part) { result[part.type] = part.value; });
    return result;
  }

  function formatClock(timestamp) {
    var parts = beijingParts(timestamp);
    return parts.hour + ':' + parts.minute;
  }

  function formatDateTime(timestamp) {
    var parts = beijingParts(timestamp);
    return parts.month + '月' + parts.day + '日 ' + parts.hour + ':' + parts.minute;
  }

  function timeAgo(date) {
    if (!date) return '';
    var diff = Date.now() - date.getTime();
    if (diff < 0) return '即将播出';
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return minutes + ' 分钟前';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' 小时前';
    var days = Math.floor(hours / 24);
    if (days < 8) return days + ' 天前';
    return (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function formatDuration(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return '';
    var total = Math.round(seconds);
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var secs = total % 60;
    if (hours > 0) return hours + ':' + pad2(minutes) + ':' + pad2(secs);
    return minutes + ':' + pad2(secs);
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (err) {
      return '';
    }
  }

  function isPlayable(url) {
    return /^https?:\/\//i.test(url || '');
  }

  function isHlsUrl(url) {
    return /\.m3u8?(\?|#|$)/i.test(url || '');
  }

  /**
   * 实际用于播放的地址。解析器会把 http 源升级成 https（GitHub Pages 上必须这样），
   * 但页面本身是 http（本地自建、内网部署）时没必要升级，否则反而播不了。
   */
  function playSrc(item) {
    if (!item) return '';
    if (location.protocol === 'http:' && /^http:\/\//i.test(item.url || '')) return item.url;
    return item.playUrl || item.url || '';
  }

  function canUseHlsJs() {
    return !!(window.Hls && window.Hls.isSupported());
  }

  /**
   * 能跑 hls.js 就交给它（Chrome / Edge / Firefox / 桌面 Safari 行为一致）；
   * 只有不支持 MSE 的环境（iOS Safari 等）才用 <video> 原生播放 HLS。
   */
  function useHlsFor(item) {
    if (!item || !canUseHlsJs()) return false;
    return isHlsUrl(playSrc(item));
  }

  /** HLS 地址在当前浏览器里完全没法播放（既没有 hls.js 也没有原生支持）。 */
  function hlsUnplayable(item) {
    return isHlsUrl(playSrc(item)) && !canUseHlsJs() && !nativeHls;
  }

  /** 没有扩展名、或扩展名不是普通视频的地址，都可能其实是 HLS。 */
  function maybeHls(item) {
    var url = playSrc(item);
    if (!url) return false;
    if (isHlsUrl(url)) return true;
    return !/\.(mp4|m4v|webm|ogg|ogv|mp3|m4a|aac|flac|wav|ts|m4s|flv)(\?|#|$)/i.test(url);
  }

  function stopHls() {
    if (hls) {
      try { hls.destroy(); } catch (err) { /* ignore */ }
      hls = null;
    }
    state.isHls = false;
  }

  /**
   * 有些直播源地址没有 .m3u8 扩展名（只有响应头能看出来）。
   * 原生播放失败时取前几百字节，确认是不是 #EXTM3U。
   */
  function probeHls(item) {
    return fetch(playSrc(item), { cache: 'no-store' }).then(function (response) {
      if (!response.ok) return false;
      if (!response.body || !response.body.getReader) return response.text().then(isHlsText);
      // 只读第一块就取消，避免把整个 mp4 都下载下来
      var reader = response.body.getReader();
      return reader.read().then(function (chunk) {
        reader.cancel().catch(function () { /* ignore */ });
        var text = '';
        if (chunk && chunk.value) {
          text = new TextDecoder('utf-8').decode(chunk.value.slice(0, 512));
        }
        return isHlsText(text);
      });
    }).catch(function () {
      return false;
    });
  }

  function isHlsText(text) {
    return /^\s*#EXTM3U/i.test(text || '');
  }

  function sameItem(a, b) {
    return !!a && !!b && a.url === b.url;
  }

  function findItem(predicate) {
    for (var i = 0; i < state.items.length; i++) {
      if (predicate(state.items[i])) return state.items[i];
    }
    return null;
  }

  function latestGroupName() {
    for (var i = 0; i < state.groups.length; i++) {
      if (/最新/.test(state.groups[i].name)) return state.groups[i].name;
    }
    return null;
  }

  function orderedGroups() {
    var groups = state.groups.slice();
    var latest = latestGroupName();
    if (!latest) return groups;
    var index = -1;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].name === latest) { index = i; break; }
    }
    if (index > 0) groups.unshift(groups.splice(index, 1)[0]);
    return groups;
  }

  function setStatus(text, kind) {
    statusEl.dataset.kind = kind || 'ok';
    statusText.textContent = text;
    statusEl.title = text;
  }

  function toast(message, kind) {
    toastEl.textContent = message;
    toastEl.dataset.kind = kind || 'info';
    toastEl.hidden = false;
    // 强制重排，保证连续调用时动画重新开始
    void toastEl.offsetWidth;
    toastEl.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
      setTimeout(function () { toastEl.hidden = true; }, 240);
    }, kind === 'error' ? 4600 : 2800);
  }

  function showNotice(text, kind, action) {
    noticeEl.hidden = false;
    noticeEl.dataset.kind = kind || 'warn';
    noticeText.textContent = text;
    noticeEl.dataset.scope = (action && action.scope) || 'source';
    if (action) {
      noticeAction.hidden = false;
      noticeAction.textContent = action.label;
      noticeAction.onclick = function () {
        hideNotice();
        action.onClick();
      };
    } else {
      noticeAction.hidden = true;
      noticeAction.onclick = null;
    }
  }

  function hideNotice(scope) {
    if (scope && noticeEl.dataset.scope !== scope) return;
    noticeEl.hidden = true;
    noticeAction.hidden = true;
  }

  function showOverlay(title, hint) {
    overlayTitle.textContent = title || '';
    overlayHint.textContent = hint || '';
    overlay.classList.remove('is-hidden');
    overlay.hidden = false;
    video.controls = false;
  }

  function hideOverlay() {
    overlay.classList.add('is-hidden');
    video.controls = true;
  }

  function showSoundPrompt() {
    soundPrompt.hidden = false;
  }

  function hideSoundPrompt() {
    soundPrompt.hidden = true;
  }

  /**
   * 浏览器允许「静音自动播放」，但不允许「带声音自动播放」。
   * 先尝试有声播放；被拦截时退回静音播放，用户第一次点击/按键后立即开启声音。
   */
  function playMuted(item) {
    state.mutedForAutoplay = true;
    video.muted = true;
    var promise = video.play();
    if (promise && promise.catch) {
      promise.catch(function (error) {
        if (error && error.name === 'AbortError') return;
        state.mutedForAutoplay = false;
        hideSoundPrompt();
        if (item) showOverlay(item.title, '点击播放，或按空格键');
      });
    }
    showSoundPrompt();
  }

  function attemptAutoplay(item) {
    if (forceMutedAutoplay) {
      playMuted(item);
      return;
    }

    var promise = video.play();
    if (!promise || !promise.catch) return;
    promise.catch(function (error) {
      if (error && error.name === 'AbortError') return;

      if (error && error.name === 'NotAllowedError') {
        playMuted(item);
        return;
      }

      if (item) showOverlay(item.title, '点击播放，或按空格键');
    });
  }

  function unmuteForGesture() {
    if (!state.mutedForAutoplay) return;
    state.mutedForAutoplay = false;
    video.muted = false;
    hideSoundPrompt();
    if (video.paused && state.current) {
      var promise = video.play();
      if (promise && promise.catch) promise.catch(function () {});
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        toast('已复制到剪贴板');
      }, function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      toast('已复制到剪贴板');
    } catch (err) {
      toast('复制失败，请手动复制', 'error');
    }
    document.body.removeChild(area);
  }

  /* ---------- 数据源 ---------- */

  function buildSources() {
    if (customSource) {
      var resolved;
      try {
        resolved = new URL(customSource, location.href).href;
      } catch (err) {
        resolved = customSource;
      }
      return [{ url: resolved, label: '自定义源', primary: false, custom: true }];
    }

    var sameOrigin = new URL('cctv_weather_forecasting.m3u', document.baseURI).href;
    return [
      { url: sameOrigin, label: '本站最新文件', primary: true },
      { url: 'https://cdn.jsdelivr.net/gh/' + REPO_SLUG + '@main/tq.m3u', label: 'jsDelivr 备用源', primary: false },
      { url: 'https://raw.githubusercontent.com/' + REPO_SLUG + '/main/tq.m3u', label: 'GitHub Raw 备用源', primary: false }
    ];
  }

  var SOURCES = buildSources();

  function fetchText(url, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 12000);
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    var requestUrl = url + separator + '_=' + Date.now();

    return fetch(requestUrl, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: { Accept: 'application/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*' }
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text().then(function (text) {
        return {
          text: text,
          lastModified: response.headers.get('last-modified'),
          finalUrl: response.url || url
        };
      });
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  /* ---------- 加载 ---------- */

  function loadPlaylist(options) {
    var opts = options || {};
    if (state.loading) return;

    state.loading = true;
    refreshBtn.classList.add('spin');
    if (!opts.silent) setStatus('正在加载最新播放列表…', 'loading');

    var errors = [];

    function trySource(index) {
      if (index >= SOURCES.length) {
        return Promise.reject(errors[errors.length - 1] || new Error('没有可用的数据源'));
      }
      var source = SOURCES[index];
      return fetchText(source.url, source.custom ? 20000 : 12000)
        .then(function (result) {
          if (!result.text || !result.text.trim()) throw new Error('文件为空');
          if (/^\s*</.test(result.text)) throw new Error('返回的是网页而不是 m3u');
          var items = Parser.parseM3U(result.text, { baseUrl: result.finalUrl, now: new Date() });
          if (!items.length) throw new Error('没有解析到节目');
          return {
            source: source,
            items: items,
            text: result.text,
            lastModified: result.lastModified
          };
        })
        .catch(function (error) {
          errors.push(error);
          return trySource(index + 1);
        });
    }

    trySource(0)
      .then(function (result) {
        finishLoad(result, opts);
      })
      .catch(function (error) {
        useCacheOrFail(error, opts);
      })
      .finally(function () {
        state.loading = false;
        refreshBtn.classList.remove('spin');
      });
  }

  function finishLoad(result, opts) {
    var items = result.items;
    var hash = Parser.hashText(result.text);
    var changed = hash !== state.hash;
    var firstLoad = state.firstLoad;
    var previousUrls = {};
    var added = 0;
    var removed = 0;
    var i;

    if (changed) {
      for (i = 0; i < state.items.length; i++) previousUrls[state.items[i].url] = true;
      for (i = 0; i < items.length; i++) {
        if (!previousUrls[items[i].url]) added++;
      }
      var newUrls = {};
      for (i = 0; i < items.length; i++) newUrls[items[i].url] = true;
      for (i = 0; i < state.items.length; i++) {
        if (!newUrls[state.items[i].url]) removed++;
      }
    }

    state.items = items;
    state.groups = Parser.groupItems(items);
    state.hash = hash;
    state.source = result.source;
    state.loadedAt = Date.now();
    state.fileTime = result.lastModified ? Date.parse(result.lastModified) : Date.now();
    if (isNaN(state.fileTime)) state.fileTime = Date.now();
    state.firstLoad = false;

    if (!state.filterGroup) {
      var requestedGroup = params.get('group');
      var playParam = params.get('play');
      var playItem = playParam ? findItem(function (item) {
        return item.url === playParam || item.playUrl === playParam;
      }) : null;

      if (requestedGroup && state.groups.some(function (group) { return group.name === requestedGroup; })) {
        state.filterGroup = requestedGroup;
      } else if (playItem) {
        state.filterGroup = playItem.group;
      } else {
        state.filterGroup = latestGroupName() || 'all';
      }
    } else if (state.filterGroup !== 'all' && !state.groups.some(function (group) {
      return group.name === state.filterGroup;
    })) {
      state.filterGroup = 'all';
    }

    saveCache(result.text, result.lastModified);

    var previousCurrent = state.current;
    var refreshedCurrent = previousCurrent ? findItem(function (item) {
      return item.url === previousCurrent.url;
    }) : null;

    if (previousCurrent && !refreshedCurrent) {
      // 正在播放的节目不在新列表里：不打断播放，只提示
      showNotice('正在播放的节目已不在最新列表中，当前播放不受影响。', 'warn', {
        label: '切换到最新',
        scope: 'source',
        onClick: function () { selectItem(defaultItem(), { play: true, scroll: true }); }
      });
    } else if (refreshedCurrent) {
      state.current = refreshedCurrent;
    }

    var playParamItem = !state.current && params.get('play') ? findItem(function (item) {
      return item.url === params.get('play') || item.playUrl === params.get('play');
    }) : null;

    if (!state.current) {
      state.current = playParamItem || defaultItem();
    }

    renderChips();
    renderList({ scroll: firstLoad });

    if (state.current) {
      applyCurrent(state.current, {
        load: !video.getAttribute('src') || !sameItem(previousCurrent, state.current),
        autoplay: firstLoad && autoplayEnabled
      });
    }

    updateMeta();
    updateSourceLinks();
    updateStatus();

    if (!firstLoad) {
      if (changed) {
        var detail = [];
        if (added) detail.push('+' + added);
        if (removed) detail.push('−' + removed);
        toast('节目单已更新' + (detail.length ? '（' + detail.join(' / ') + ' 个节目）' : ''));
      } else if (opts.manual) {
        toast('已是最新节目单');
      }
    }

    if (state.source && !state.source.primary && !state.source.custom) {
      showNotice('主数据源暂时不可用，当前使用' + state.source.label + '（可能不是最新）。稍后点「刷新」重试。', 'warn');
    } else if (firstLoad) {
      hideNotice();
    }

    notifyParent('cwp:ready', {
      count: state.items.length,
      groups: state.groups.length,
      updatedAt: state.fileTime
    });

    if (opts.manual) {
      setStatus('已刷新 · ' + state.items.length + ' 个节目 · ' + formatClock(state.fileTime) + ' 更新', 'ok');
    }
  }

  function defaultItem() {
    // 指定了栏目时，默认选中该栏目的第一条
    if (state.filterGroup && state.filterGroup !== 'all') {
      var selectedGroup = state.groups.filter(function (item) {
        return item.name === state.filterGroup;
      })[0];
      if (selectedGroup && selectedGroup.items.length) return selectedGroup.items[0];
    }
    var latest = latestGroupName();
    if (latest) {
      var group = state.groups.filter(function (item) { return item.name === latest; })[0];
      if (group && group.items.length) return group.items[0];
    }
    return state.items[0] || null;
  }

  function useCacheOrFail(error, opts) {
    var cached = readCache();
    if (cached) {
      try {
        var items = Parser.parseM3U(cached.text, { baseUrl: cached.url, now: new Date() });
        if (items.length) {
          var result = {
            source: { label: '本地缓存', primary: false, cached: true },
            items: items,
            text: cached.text,
            lastModified: cached.savedAt ? new Date(cached.savedAt).toUTCString() : null
          };
          finishLoad(result, opts);
          showNotice('网络不可用，正在显示 ' + formatDateTime(cached.savedAt) + ' 缓存的本节目单。', 'warn', {
            label: '重试',
            scope: 'source',
            onClick: function () { loadPlaylist({ manual: true }); }
          });
          setStatus('离线缓存 · ' + items.length + ' 个节目', 'warn');
          return;
        }
      } catch (cacheError) { /* 缓存损坏，走失败分支 */ }
    }

    state.loading = false;
    refreshBtn.classList.remove('spin');
    setStatus('加载失败：' + (error && error.message ? error.message : '网络错误'), 'error');
    showOverlay('播放列表加载失败', '请检查网络后点击下方按钮重试');
    overlayTitle.textContent = '播放列表加载失败';
    overlayHint.textContent = '请检查网络连接，或点「刷新」重试';
    playerBadge.hidden = true;

    if (!state.items.length) {
      listEl.replaceChildren();
      var box = document.createElement('div');
      box.className = 'list-error';
      var strong = document.createElement('strong');
      strong.textContent = '暂时无法加载节目单';
      var p = document.createElement('span');
      p.textContent = customSource ? '自定义 m3u 地址无法加载，请检查地址和跨域设置。' : '主数据源和备用源都不可用，请稍后再试。';
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn btn-primary';
      retry.textContent = '重新加载';
      retry.addEventListener('click', function () { loadPlaylist({ manual: true }); });
      box.append(strong, p, retry);
      listEl.appendChild(box);
    }

    var detail = error && error.name === 'AbortError' ? '请求超时' : (error && error.message) || '未知错误';
    toast('加载失败：' + detail, 'error');
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.text) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function saveCache(text, lastModified) {
    if (!text || text.length > 2 * 1024 * 1024) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        text: text,
        url: state.source ? state.source.url : location.href,
        savedAt: Date.now(),
        lastModified: lastModified || null
      }));
    } catch (err) { /* 配额不足时忽略 */ }
  }

  /* ---------- 渲染 ---------- */

  function renderChips() {
    chipsEl.replaceChildren();
    var total = document.createElement('button');
    total.type = 'button';
    total.className = 'chip';
    total.setAttribute('role', 'tab');
    total.dataset.group = 'all';
    total.setAttribute('aria-selected', String(state.filterGroup === 'all'));
    total.append(document.createTextNode('全部'));
    total.appendChild(countSpan(state.items.length));
    total.addEventListener('click', function () { setFilter('all'); });
    chipsEl.appendChild(total);

    orderedGroups().forEach(function (group) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip' + (/最新/.test(group.name) ? ' chip-latest' : '');
      button.setAttribute('role', 'tab');
      button.dataset.group = group.name;
      button.setAttribute('aria-selected', String(state.filterGroup === group.name));
      if (/最新/.test(group.name)) {
        button.append(document.createTextNode('★ '));
      }
      button.append(document.createTextNode(group.name));
      button.appendChild(countSpan(group.items.length));
      button.addEventListener('click', function () { setFilter(group.name); });
      chipsEl.appendChild(button);
    });
  }

  function countSpan(count) {
    var span = document.createElement('span');
    span.className = 'chip-count';
    span.textContent = String(count);
    return span;
  }

  function setFilter(name) {
    state.filterGroup = name;
    renderChips();
    renderList({ scroll: false });
    var chip = chipsEl.querySelector('[data-group="' + cssEscape(name) + '"]');
    if (chip) chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function matchesQuery(item) {
    if (!state.query) return true;
    var needle = state.query.toLowerCase();
    return item.title.toLowerCase().indexOf(needle) !== -1 ||
      item.group.toLowerCase().indexOf(needle) !== -1;
  }

  function renderList(options) {
    var opts = options || {};
    var groups = orderedGroups();
    var sections = [];
    var visible = [];

    groups.forEach(function (group) {
      if (state.filterGroup !== 'all' && group.name !== state.filterGroup) return;
      var items = group.items.filter(matchesQuery);
      if (!items.length) return;
      sections.push({ name: group.name, items: items });
      visible = visible.concat(items);
    });

    state.visible = visible;
    state.rendered = [];
    listEl.replaceChildren();

    if (!sections.length) {
      var empty = document.createElement('div');
      empty.className = 'list-empty';
      empty.textContent = state.query
        ? '没有找到匹配「' + state.query + '」的节目'
        : '这个栏目暂时没有节目';
      if (state.query && state.filterGroup !== 'all') {
        var allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'btn';
        allBtn.textContent = '在全部栏目中搜索';
        allBtn.addEventListener('click', function () {
          state.filterGroup = 'all';
          renderChips();
          renderList({});
        });
        empty.appendChild(allBtn);
      }
      listEl.appendChild(empty);
      listMeta.textContent = '0 个节目';
      clearFilterBtn.hidden = !state.query && state.filterGroup === 'all';
      updatePager();
      return;
    }

    var fragment = document.createDocumentFragment();
    var activeEl = null;

    sections.forEach(function (section) {
      var sectionEl = document.createElement('section');
      sectionEl.className = 'group';

      var title = document.createElement('h3');
      title.className = 'group-title';
      title.append(document.createTextNode(section.name));
      var count = document.createElement('span');
      count.className = 'count';
      count.textContent = String(section.items.length);
      title.appendChild(count);
      if (/最新/.test(section.name)) {
        var hint = document.createElement('span');
        hint.className = 'hint';
        hint.textContent = '最近播出';
        title.appendChild(hint);
      }
      sectionEl.appendChild(title);

      section.items.forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'item';
        button.dataset.id = item.id;
        if (state.current && item.url === state.current.url) {
          button.classList.add('is-active');
          button.setAttribute('aria-current', 'true');
          if (!activeEl) activeEl = button;
        }

        var main = document.createElement('span');
        main.className = 'item-main';

        var name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = item.title;
        main.appendChild(name);

        var subParts = [];
        if (item.publishedAt) subParts.push(timeAgo(item.publishedAt));
        if (item.duration) subParts.push(formatDuration(item.duration));
        if (!subParts.length) subParts.push(hostOf(item.url));

        if (subParts.length) {
          var sub = document.createElement('span');
          sub.className = 'item-sub';
          subParts.forEach(function (part, index) {
            if (index > 0) {
              var dot = document.createElement('span');
              dot.className = 'dot';
              sub.appendChild(dot);
            }
            sub.appendChild(document.createTextNode(part));
          });
          main.appendChild(sub);
        }

        var play = document.createElement('span');
        play.className = 'item-play';
        play.setAttribute('aria-hidden', 'true');
        play.textContent = '▶';

        button.append(main, play);
        button.addEventListener('click', function () {
          selectItem(item, { play: true, scroll: false });
        });

        sectionEl.appendChild(button);
        state.rendered.push({ item: item, el: button });
      });

      fragment.appendChild(sectionEl);
    });

    listEl.appendChild(fragment);
    clearFilterBtn.hidden = !state.query && state.filterGroup === 'all';

    if (opts.scroll) {
      if (activeEl) {
        scrollActiveIntoView(activeEl);
      } else if (listEl.firstElementChild) {
        listEl.scrollTop = 0;
      }
    }

    updatePager();
    listMeta.textContent = visible.length === state.items.length
      ? state.items.length + ' 个节目'
      : visible.length + ' / ' + state.items.length + ' 个节目';
  }

  function scrollActiveIntoView(element) {
    if (!element) return;
    var listRect = listEl.getBoundingClientRect();
    var rect = element.getBoundingClientRect();
    if (rect.top < listRect.top + 40 || rect.bottom > listRect.bottom - 10) {
      element.scrollIntoView({ block: 'nearest' });
    }
  }

  function markActive() {
    state.rendered.forEach(function (entry) {
      var active = !!(state.current && entry.item.url === state.current.url);
      entry.el.classList.toggle('is-active', active);
      if (active) entry.el.setAttribute('aria-current', 'true');
      else entry.el.removeAttribute('aria-current');
    });
  }

  function updatePager() {
    var has = !!state.current && state.visible.length > 0;
    prevBtn.disabled = !has;
    nextBtn.disabled = !has;
  }

  /* ---------- 选台与播放 ---------- */

  function selectItem(item, options) {
    var opts = options || {};
    if (!item) return;
    if (!isPlayable(item.playUrl)) {
      toast('浏览器无法播放该地址（仅支持 http/https 视频）', 'error');
      return;
    }

    var same = sameItem(state.current, item);
    state.current = item;
    if (noticeEl.dataset.scope === 'playback') hideNotice();

    applyCurrent(item, { load: !same || !video.getAttribute('src'), autoplay: opts.play });
    markActive();
    updatePager();

    if (opts.scroll) {
      var entry = state.rendered.filter(function (row) { return row.item.url === item.url; })[0];
      if (entry) scrollActiveIntoView(entry.el);
    }

    notifyParent('cwp:change', {
      title: item.title,
      group: item.group,
      url: item.url
    });
  }

  function applyCurrent(item, options) {
    var opts = options || {};
    // 切台时先清掉上一个频道的直播状态，再刷新信息区
    if (opts.load) state.live = false;
    updateNowCard(item);

    if (opts.load) {
      state.triedOriginal = false;
      state.triedHlsProbe = false;
      stopHls();
      playerBadge.hidden = true;

      if (useHlsFor(item)) {
        state.isHls = true;
        showOverlay(item.title, '正在连接直播…');
        loadHls(item, opts);
        return;
      }

      if (hlsUnplayable(item)) {
        showOverlay('无法播放直播', '当前浏览器不支持 HLS 直播流');
        showNotice('当前浏览器不支持 HLS 直播流，换用 Chrome / Edge / Firefox 或 Safari 试试。', 'error', {
          label: '下一个频道',
          scope: 'playback',
          onClick: function () { step(1); }
        });
        setStatus('该直播源需要 HLS 支持', 'warn');
        return;
      }

      video.src = playSrc(item);
      video.load();
      showOverlay(item.title, '点击播放，或按空格键');
      armSlowNotice(item, maybeHls(item));
    } else if (video.paused) {
      showOverlay(item.title, '点击播放，或按空格键');
    }

    if (opts.autoplay) {
      video.preload = 'auto';
      attemptAutoplay(item);
    }
  }

  /** 加载迟迟没有画面时给一句提示（有的直播源其实是被跨域挡住了）。 */
  function armSlowNotice(item, liveHint) {
    setTimeout(function () {
      if (!sameItem(state.current, item) || video.readyState >= 2 || state.live) return;
      showOverlay(item.title, liveHint ? '加载较慢，源站可能限制了访问…' : '加载较慢…');
      showNotice(liveHint
        ? '这个频道加载不出来：源站可能不允许跨域，或链接已失效。'
        : '加载较慢，可以稍等一会儿或换下一个节目。', 'warn', {
        label: '下一个频道',
        scope: 'playback',
        onClick: function () { step(1); }
      });
      slowNotice = true;
    }, 25000);
  }

  /** 用 hls.js 拉取直播流；这些 IPTV 源分片较大，超时时间放得比较宽。 */
  function loadHls(item, opts) {
    var instance = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      manifestLoadingTimeOut: 30000,
      manifestLoadingMaxRetry: 3,
      levelLoadingTimeOut: 30000,
      levelLoadingMaxRetry: 3,
      fragLoadingTimeOut: 45000,
      fragLoadingMaxRetry: 3
    });
    hls = instance;
    var recovered = false;
    var failed = false;

    // 有的源站响应很慢，长时间没画面时给一句提示，避免看起来像卡死
    var slowTimer = setTimeout(function () {
      if (failed || hls !== instance || video.readyState >= 2) return;
      showOverlay(item.title, '源站响应较慢，仍在连接…');
    }, 20000);

    instance.on(Hls.Events.MANIFEST_PARSED, function () {
      if (opts.autoplay) {
        video.preload = 'auto';
        attemptAutoplay(item);
      } else if (video.paused) {
        showOverlay(item.title, '点击播放，或按空格键');
      }
    });

    instance.on(Hls.Events.LEVEL_LOADED, function (event, data) {
      if (data && data.details && data.details.live) markLive();
    });

    instance.on(Hls.Events.ERROR, function (event, data) {
      if (!data || !data.fatal) return;

      var details = data.details || '';
      // 播放列表本身拿不到（地址失效、跨域、编码不支持）：重试也没用，直接提示
      if (details.indexOf('manifest') === 0) {
        failed = true;
        clearTimeout(slowTimer);
        hlsFailed(item, data);
        return;
      }

      // 先尝试一次自动恢复，仍失败再提示用户
      if (!recovered && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        recovered = true;
        instance.recoverMediaError();
        return;
      }
      if (!recovered && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        recovered = true;
        instance.startLoad();
        return;
      }
      failed = true;
      clearTimeout(slowTimer);
      hlsFailed(item, data);
    });

    instance.attachMedia(video);
    instance.loadSource(playSrc(item));
  }

  /** 原生播放失败后改走 hls.js（通常是老版本 Chrome / Firefox 没有原生 HLS）。 */
  function loadHlsFromError(item) {
    state.isHls = true;
    state.live = false;
    showOverlay(item.title, '正在连接直播…');
    loadHls(item, { autoplay: true });
  }

  function markLive() {
    if (state.live) return;
    state.live = true;
    nowTime.hidden = true;
    nowDuration.hidden = false;
    nowDuration.textContent = '直播';
    nowDuration.title = 'HLS 直播流';
    updateMeta();
  }

  function hlsFailed(item, data) {
    var reason = '直播加载失败，可能是源站链接已失效';
    var details = (data && data.details) || '';
    if (/IncompatibleCodecs/i.test(details)) {
      reason = '浏览器不支持这个直播流的编码（可能是 H.265 / AC-3）';
    } else if (data && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      reason = '直播间无法访问：源站不允许跨域，或链接已失效';
    } else if (data && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      reason = '浏览器不支持这个直播流的编码（可能是 H.265 / AC-3）';
    }
    showOverlay('无法播放直播', '可以试试同栏目的其他频道');
    showNotice(reason + '。', 'error', {
      label: '下一个频道',
      scope: 'playback',
      onClick: function () { step(1); }
    });
    setStatus('直播播放失败 · 可尝试下一个', 'warn');
    hideSoundPrompt();
    notifyParent('cwp:error', { message: reason, title: item.title });
  }

  function updateNowCard(item) {
    if (!item) return;
    nowTitle.textContent = item.title;
    nowGroup.textContent = item.group;

    if (item.publishedAt) {
      nowTime.hidden = false;
      nowTime.textContent = timeAgo(item.publishedAt);
      nowTime.title = formatDateTime(item.publishedAt.getTime()) + '（北京时间）';
    } else {
      nowTime.hidden = true;
      nowTime.textContent = '';
    }

    if (item.duration) {
      nowDuration.hidden = false;
      nowDuration.textContent = '时长 ' + formatDuration(item.duration);
    } else {
      nowDuration.hidden = true;
      nowDuration.textContent = '';
      nowDuration.title = '';
    }

    updateMeta();
  }

  function updateMeta() {
    if (!state.current) {
      nowMeta.textContent = '节目单每 ' + refreshMinutes + ' 分钟自动更新';
      return;
    }
    var groupItems = state.items.filter(function (item) { return item.group === state.current.group; });
    var index = groupItems.findIndex(function (item) { return item.url === state.current.url; });
    var parts = [];
    parts.push('来源：' + (state.source ? state.source.label : '最新 m3u'));
    parts.push('更新于 ' + formatClock(state.fileTime || Date.now()));
    if (state.live) parts.push('直播中');
    else if (index >= 0) parts.push('第 ' + (index + 1) + '/' + groupItems.length + ' 个');
    nowMeta.textContent = parts.join(' · ');
  }

  function updateStatus() {
    if (!state.items.length) return;
    setStatus('已加载 ' + state.items.length + ' 个节目 · ' + formatClock(state.fileTime) + ' 更新', 'ok');
  }

  function updateSourceLinks() {
    if (!state.source) return;
    var url = state.source.url || RELEASE_URL;
    sourceLink.href = url;
    sourceLink.textContent = 'm3u 地址 ↗';
    downloadLink.href = url;
  }

  function queue() {
    return state.visible.length ? state.visible : state.items;
  }

  function step(delta) {
    if (!state.current) return;
    var list = queue();
    if (!list.length) return;
    var index = list.findIndex(function (item) { return item.url === state.current.url; });
    var target;
    if (index === -1) {
      target = list[0];
    } else {
      target = list[index + delta];
      if (!target) target = delta > 0 ? list[0] : list[list.length - 1];
    }
    selectItem(target, { play: true, scroll: true });
  }

  function playNextAfterEnded() {
    if (!state.autoNext) {
      showOverlay('播放完毕', '自动连播已关闭，可选择下一个节目');
      return;
    }
    var list = queue();
    var index = state.current ? list.findIndex(function (item) {
      return item.url === state.current.url;
    }) : -1;
    var next = index >= 0 ? list[index + 1] : null;
    if (!next) {
      showOverlay('本栏目已播放完毕', '可以切换栏目，或点「刷新」获取最新节目');
      return;
    }
    selectItem(next, { play: true, scroll: true });
  }

  /* ---------- 视频事件 ---------- */

  video.addEventListener('play', function () {
    if (state.items.length) updateStatus();
    if (state.mutedForAutoplay && video.muted) showSoundPrompt();
    else hideSoundPrompt();
    if (state.current) {
      playerBadge.hidden = !/最新/.test(state.current.group);
      playerBadge.textContent = state.current.group;
      notifyParent('cwp:playing', {
        title: state.current.title,
        group: state.current.group,
        url: state.current.url
      });
    }
  });

  video.addEventListener('pause', function () {
    playerBadge.hidden = true;
    hideSoundPrompt();
  });

  // 真正出画面后再收起遮罩：直播起播慢的时候不会留下一块没有提示的黑屏
  video.addEventListener('playing', function () {
    hideOverlay();
    if (slowNotice) {
      hideNotice('playback');
      slowNotice = false;
    }
  });

  video.addEventListener('volumechange', function () {
    if (!video.muted && state.mutedForAutoplay) {
      state.mutedForAutoplay = false;
      hideSoundPrompt();
    }
  });

  video.addEventListener('ended', function () {
    playerBadge.hidden = true;
    hideSoundPrompt();
    playNextAfterEnded();
  });

  video.addEventListener('loadedmetadata', function () {
    if (!state.current) return;
    if (state.live) return; // 直播没有固定时长，别把「直播」标签覆盖成时长
    if (!state.current.duration && isFinite(video.duration) && video.duration > 0) {
      nowDuration.hidden = false;
      nowDuration.textContent = '时长 ' + formatDuration(video.duration);
    }
  });

  function failPlayback(item, errorCode, liveHint) {
    var reason = '视频加载失败';
    var code = errorCode || (video.error ? video.error.code : 0);
    if (code === 2) reason = '网络错误，视频源无法访问';
    else if (code === 3) reason = '视频解码失败';
    else if (code === 4) reason = '视频格式或地址不可用（可能已过期）';
    if (liveHint) reason = '直播间无法访问（源站不允许跨域，或链接已失效）';

    showOverlay('无法播放：' + reason, '可能是源站链接已过期，试试同栏目的下一个节目');
    showNotice(reason + (liveHint ? '。' : '。微博等源站的链接会过期，请刷新获取最新节目单或播放下一條。'), 'error', {
      label: '播放下一条',
      scope: 'playback',
      onClick: function () { step(1); }
    });
    setStatus('视频播放失败 · 可尝试下一条', 'warn');
    hideSoundPrompt();
    notifyParent('cwp:error', { message: reason, title: item ? item.title : '' });
  }

  video.addEventListener('error', function () {
    if (!state.current) return;
    // HLS 的错误由 hls.js 的事件处理，video.error 在这里没有有效信息
    if (state.isHls) return;

    var item = state.current;
    var errorCode = video.error ? video.error.code : 0;

    // 没有原生 HLS 或原生播放失败：可能是 HLS，试着交给 hls.js
    if (!state.triedHlsProbe && canUseHlsJs() && maybeHls(item)) {
      state.triedHlsProbe = true;
      if (isHlsUrl(item.playUrl)) {
        loadHlsFromError(item);
        return;
      }
      probeHls(item).then(function (ok) {
        if (!sameItem(state.current, item)) return;
        if (!ok) {
          failPlayback(item, errorCode, true);
          return;
        }
        loadHlsFromError(item);
      });
      return;
    }

    if (!state.triedOriginal && playSrc(item) !== item.url && isPlayable(item.url)) {
      // https 版本不可用时，退回原始地址再试一次
      state.triedOriginal = true;
      video.src = item.url;
      video.load();
      if (!video.paused) video.play().catch(function () {});
      showNotice('https 地址播放失败，已尝试原始地址。', 'warn', {
        label: '下一条',
        scope: 'playback',
        onClick: function () { step(1); }
      });
      return;
    }

    failPlayback(item, errorCode);
  });

  /* ---------- 交互 ---------- */

  soundPrompt.addEventListener('click', function (event) {
    event.stopPropagation();
    unmuteForGesture();
  });

  // 用户第一次点击/按键后，把自动播放时的静音解除
  document.addEventListener('click', unmuteForGesture, true);
  document.addEventListener('keydown', unmuteForGesture, true);

  bigPlay.addEventListener('click', function (event) {
    event.stopPropagation();
    if (!state.current) {
      loadPlaylist({ manual: true });
      return;
    }
    var promise = video.play();
    if (promise && promise.catch) {
      promise.catch(function (error) {
        if (error && error.name === 'AbortError') return;
        showNotice('浏览器未能开始播放，请再点一次或选择其他节目。', 'warn', {
          label: '下一条',
          scope: 'playback',
          onClick: function () { step(1); }
        });
      });
    }
  });

  overlay.addEventListener('click', function (event) {
    if (event.target.closest('button')) return;
    if (state.current) {
      var promise = video.play();
      if (promise && promise.catch) promise.catch(function () {});
    }
  });

  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });

  refreshBtn.addEventListener('click', function () {
    loadPlaylist({ manual: true });
  });

  autoNextInput.addEventListener('change', function () {
    state.autoNext = autoNextInput.checked;
    saveAutoNext(state.autoNext);
    toast(state.autoNext ? '已开启自动连播' : '已关闭自动连播');
  });

  searchInput.addEventListener('input', function () {
    state.query = searchInput.value.trim();
    // 输入关键词时自动在全部栏目中搜索，避免只搜到当前栏目的少量结果
    if (state.query && state.filterGroup !== 'all') {
      state.filterGroup = 'all';
      renderChips();
    }
    renderList({ scroll: false });
  });

  clearFilterBtn.addEventListener('click', function () {
    state.query = '';
    searchInput.value = '';
    state.filterGroup = 'all';
    renderChips();
    renderList({ scroll: false });
    searchInput.focus();
  });

  moreBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    var open = moreMenu.hidden;
    moreMenu.hidden = !open;
    moreBtn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', function (event) {
    if (!moreMenu.hidden && !moreMenu.contains(event.target) && !moreBtn.contains(event.target)) {
      moreMenu.hidden = true;
      moreBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      moreMenu.hidden = true;
      moreBtn.setAttribute('aria-expanded', 'false');
    }
  });

  copyBtn.addEventListener('click', function () {
    moreMenu.hidden = true;
    if (!state.current) return;
    copyText(state.current.url);
  });

  openBtn.addEventListener('click', function () {
    moreMenu.hidden = true;
    if (!state.current) return;
    window.open(state.current.playUrl, '_blank', 'noopener');
  });

  shareBtn.addEventListener('click', function () {
    moreMenu.hidden = true;
    copyText(location.href);
  });

  // 捕获阶段处理：视频获得焦点后，浏览器原生控件会先吃掉空格键，
  // 只有先在 document 捕获阶段拦截，空格才始终是“播放 / 暂停”。
  document.addEventListener('keydown', function (event) {
    var typing = isTypingTarget(event.target);
    if (typing) {
      if (event.key === 'Escape' && event.target === searchInput) {
        searchInput.value = '';
        state.query = '';
        renderList({ scroll: false });
        searchInput.blur();
      }
      return;
    }

    if (event.key === '/') {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (event.key === ' ' || event.code === 'Space') {
      // 阻止视频原生控件的空格处理，否则会和我们各切换一次，表现为“动一下就停”
      event.preventDefault();
      event.stopPropagation();
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'r' || event.key === 'R') {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) loadPlaylist({ manual: true });
    }
  }, true);

  // 有的浏览器在 keyup / keypress 阶段才处理视频控件的空格，
  // 一并拦掉，保证一次按键只切换一次。
  ['keyup', 'keypress'].forEach(function (type) {
    document.addEventListener(type, function (event) {
      if ((event.key === ' ' || event.code === 'Space') && !isTypingTarget(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  });
  /* ---------- 自动刷新 ---------- */

  setInterval(function () {
    if (document.hidden) return;
    if (!state.items.length) return;
    if (Date.now() - state.loadedAt >= refreshMs) loadPlaylist({ silent: true });
  }, 60000);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !state.items.length) return;
    if (Date.now() - state.loadedAt > Math.min(refreshMs, 5 * 60 * 1000)) {
      loadPlaylist({ silent: true });
    }
  });

  /* ---------- 嵌入通信 ---------- */

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'cwp:refresh') {
      loadPlaylist({ manual: true });
    } else if (data.type === 'cwp:play') {
      var item = null;
      if (data.url) {
        item = findItem(function (candidate) {
          return candidate.url === data.url || candidate.playUrl === data.url;
        });
      }
      if (!item && data.title) {
        item = findItem(function (candidate) { return candidate.title === data.title; });
      }
      if (item) selectItem(item, { play: true, scroll: true });
    }
  });

  function notifyParent(type, payload) {
    if (window.parent === window) return;
    try {
      window.parent.postMessage(Object.assign({ type: type }, payload || {}), '*');
    } catch (err) { /* ignore */ }
  }

  /* ---------- 启动 ---------- */

  window.addEventListener('pagehide', stopHls);

  updatePager();
  loadPlaylist({});
})();
