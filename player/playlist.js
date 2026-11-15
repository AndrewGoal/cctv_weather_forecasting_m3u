/**
 * 轻量 m3u / m3u8 播放列表解析器。
 * 同时支持浏览器（window.PlaylistParser）与 Node（require）环境，便于单元测试。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.PlaylistParser = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ATTR_RE = /([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/g;

  /** 去掉 #EXTINF: 后面的时长与属性，按引号外的第一个逗号切出标题。 */
  function splitExtinf(body) {
    var inQuotes = false;
    var commaAt = -1;
    for (var i = 0; i < body.length; i++) {
      var ch = body.charAt(i);
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        commaAt = i;
        break;
      }
    }
    if (commaAt === -1) return { head: body.trim(), title: '' };
    return {
      head: body.slice(0, commaAt).trim(),
      title: body.slice(commaAt + 1).trim()
    };
  }

  function parseAttributes(head) {
    var attrs = {};
    if (!head) return attrs;
    var match;
    ATTR_RE.lastIndex = 0;
    while ((match = ATTR_RE.exec(head))) {
      attrs[match[1].toLowerCase()] = match[2];
    }
    return attrs;
  }

  /** #EXTINF:81.13 → 81.13（秒）。-1 等无效值返回 null。 */
  function parseDuration(head) {
    var token = String(head || '').trim().split(/\s+/)[0];
    var value = parseFloat(token);
    return isFinite(value) && value > 0 ? value : null;
  }

  function resolveUrl(raw, baseUrl) {
    var url = String(raw || '').trim();
    if (!url) return '';
    try {
      return new URL(url, baseUrl || undefined).href;
    } catch (err) {
      return url;
    }
  }

  /**
   * 播放地址尽量升级到 https。
   * 部署在 GitHub Pages（https）上时，http 视频会被浏览器当作混合内容拦截；
   * 本项目的数据源（天气网、齐鲁网）均支持 https。
   */
  function toHttps(url) {
    if (!/^http:\/\//i.test(url || '')) return url;
    try {
      var parsed = new URL(url);
      parsed.protocol = 'https:';
      return parsed.href;
    } catch (err) {
      return url;
    }
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function beijingDate(year, month, day, hour, minute) {
    var date = new Date(
      year + '-' + pad2(month) + '-' + pad2(day) + 'T' +
      pad2(hour) + ':' + pad2(minute) + ':00+08:00'
    );
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * 从节目标题中尽力解析播出时间，例如：
   *   中央二早25日08:42 / 11月24日19:31 / 2026-11-25 08:42
   * 标题里没有时间时返回 null。无年份的标题按“最近的一次”推断年份。
   */
  function parseTitleDate(title, now) {
    var text = String(title || '').trim();
    if (!text) return null;
    var reference = now instanceof Date ? now : new Date();

    var full = text.match(/(\d{4})\s*[-年/]\s*(\d{1,2})\s*[-月/]\s*(\d{1,2})\s*日?\s*(\d{1,2})[:：](\d{2})/);
    if (full) {
      return beijingDate(+full[1], +full[2], +full[3], +full[4], +full[5]);
    }

    var monthDay = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(\d{1,2})[:：](\d{2})/);
    if (monthDay) {
      return inferYear(+monthDay[1], +monthDay[2], +monthDay[3], +monthDay[4], reference);
    }

    var dayOnly = text.match(/(?:^|[^\d])(\d{1,2})\s*日\s*(\d{1,2})[:：](\d{2})/);
    if (dayOnly) {
      return inferYear(null, +dayOnly[1], +dayOnly[2], +dayOnly[3], reference);
    }

    return null;
  }

  function inferYear(month, day, hour, minute, now) {
    var year = Number(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric'
    }).format(now)) || now.getFullYear();

    // 只有“日”没有“月”时，按本月推断；若日期明显在未来（跨月），回退一个月。
    if (month == null) {
      var beijing = new Date(now.getTime() + 8 * 3600 * 1000);
      month = beijing.getUTCMonth() + 1;
      var candidate = beijingDate(year, month, day, hour, minute);
      if (candidate && candidate.getTime() > now.getTime() + 2 * 86400000) {
        month -= 1;
        if (month === 0) {
          month = 12;
          year -= 1;
        }
      }
      return beijingDate(year, month, day, hour, minute);
    }

    var date = beijingDate(year, month, day, hour, minute);
    if (date && date.getTime() > now.getTime() + 2 * 86400000) {
      date = beijingDate(year - 1, month, day, hour, minute);
    }
    return date;
  }

  function titleFromUrl(url) {
    try {
      var parsed = new URL(url);
      var name = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
      return name || parsed.hostname;
    } catch (err) {
      return url;
    }
  }

  /**
   * 解析 m3u 文本。
   * @param {string} text 播放列表内容
   * @param {{baseUrl?: string, now?: Date}} [options]
   * @returns {Array<object>} 条目数组，字段：title/group/url/playUrl/duration/publishedAt/attrs
   */
  function parseM3U(text, options) {
    var opts = options || {};
    if (!text || typeof text !== 'string') return [];

    var content = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var lines = content.split('\n');
    var items = [];
    var pending = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      if (line.charAt(0) === '#') {
        var upper = line.toUpperCase();
        if (upper.indexOf('#EXTINF:') === 0) {
          var parts = splitExtinf(line.slice(8));
          pending = {
            attrs: parseAttributes(parts.head),
            title: parts.title,
            duration: parseDuration(parts.head),
            group: ''
          };
          if (pending.attrs['group-title']) pending.group = pending.attrs['group-title'];
        } else if (upper.indexOf('#EXTGRP:') === 0 && pending) {
          pending.group = line.slice(8).trim();
        }
        continue;
      }

      var url = resolveUrl(line, opts.baseUrl);
      if (!url) continue;

      var attrs = pending ? pending.attrs : {};
      var title = (pending && pending.title) || attrs['tvg-name'] || titleFromUrl(url);
      var group = (pending && pending.group) || attrs['group-title'] || '未分组';
      if (!pending && !attrs['group-title']) group = '未分组';

      items.push({
        id: 'ch-' + items.length,
        title: title,
        group: group,
        url: url,
        playUrl: toHttps(url),
        duration: pending ? pending.duration : null,
        publishedAt: parseTitleDate(title, opts.now),
        attrs: attrs
      });
      pending = null;
    }

    return items;
  }

  /** 按首次出现顺序分组，保留原顺序（m3u 内通常已是时间倒序）。 */
  function groupItems(items) {
    var order = [];
    var map = {};
    for (var i = 0; i < items.length; i++) {
      var group = items[i].group || '未分组';
      if (!map[group]) {
        map[group] = [];
        order.push(group);
      }
      map[group].push(items[i]);
    }
    return order.map(function (name) {
      return { name: name, items: map[name] };
    });
  }

  /** 32 位 FNV-1a，用于判断刷新后的播放列表是否变化。 */
  function hashText(text) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return ('00000000' + hash.toString(16)).slice(-8);
  }

  return {
    parseM3U: parseM3U,
    groupItems: groupItems,
    parseTitleDate: parseTitleDate,
    toHttps: toHttps,
    hashText: hashText
  };
});
