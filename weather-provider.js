/**
 * 气象万千 · 浏览器端实时生成 Provider
 *
 * 依赖海纳百川-播放器提供的 window.M3UPlayer.registerProvider()。
 * 数据源与根目录 app.js 相同，但按浏览器能力做了两处调整：
 *   1. 天气网改为 JSONP（该接口无 CORS 头，但返回固定回调 getLbDatas(...)）
 *   2. 齐鲁网改为裸 GET（原脚本里的 Cookie/Referer/自定义 header 在浏览器里不可用）
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else if (api && root.M3UPlayer && root.M3UPlayer.registerProvider) {
    root.M3UPlayer.registerProvider('weatherLive', api.createProvider());
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var WEATHER_PAGES = [
    'video_lianbo_2021', 'zhaowen', 'wujian',
    'diyiyinxiang', 'cctv4', 'tiyu', 'cctv7'
  ];

  var WEATHER_GROUPS = [
    '七点半', '中央13早', '中央一午', '中央二早',
    '中央四', '体育天气', '中央七'
  ];

  var SD_SOURCES = [
    { cateid: 101559, name: '山东晚', time: '19:31' },
    { cateid: 101529, name: '山东早', time: '06:56' }
  ];

  function isoDateByOffset(date, offsetMinutes) {
    var adjusted = new Date(date.getTime() + Date.UTC(1970, 0, 1, -offsetMinutes / 60));
    return adjusted.toISOString().replace('Z', '+' + ('0' + (offsetMinutes * -1 / 60)).slice(-2) + ':00');
  }

  function beijingDateString(date) {
    return isoDateByOffset(date, -480).slice(0, 10);
  }

  /** 天气网接口回调名写死为 getLbDatas，必须串行加载并在结束后还原。 */
  function loadWeatherJsonp(page) {
    return new Promise(function (resolve, reject) {
      var doc = root.document;
      if (!doc || !doc.head || typeof doc.createElement !== 'function') {
        reject(new Error('JSONP 只能在浏览器环境中使用'));
        return;
      }

      var script = doc.createElement('script');
      var previous = root.getLbDatas;
      var settled = false;

      function finish(error, data) {
        if (settled) return;
        settled = true;
        if (root.clearTimeout && timer) root.clearTimeout(timer);
        root.getLbDatas = previous;
        if (script.parentNode) script.parentNode.removeChild(script);
        if (error) reject(error);
        else resolve(data);
      }

      root.getLbDatas = function (data) { finish(null, data); };
      script.src = 'https://www.weather.com.cn/pubm/' + page + '.htm?_=' + Date.now();
      script.async = false;
      script.onerror = function () { finish(new Error('无法加载天气网数据：' + page)); };

      var timer = root.setTimeout
        ? root.setTimeout(function () { finish(new Error('天气网数据超时：' + page)); }, 15000)
        : null;

      doc.head.appendChild(script);
    });
  }

  function fetchIqilu(cateid, date) {
    var fetchFn = root.fetch;
    if (typeof fetchFn !== 'function') return Promise.reject(new Error('当前环境不支持 fetch'));

    var controller = root.AbortController ? new root.AbortController() : null;
    var timer = controller && root.setTimeout
      ? root.setTimeout(function () { controller.abort(); }, 12000)
      : null;
    var url = 'https://sdxw.iqilu.com/v2/app/media/program/video/lists' +
      '?cateid=' + cateid + '&plat=cq&date=' + date + '&page=1';

    return fetchFn(url, {
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error('齐鲁网 HTTP ' + response.status);
      return response.json();
    }).then(function (json) {
      return json && json.data && json.data.infos ? json.data.infos : [];
    }).finally(function () {
      if (timer) root.clearTimeout(timer);
    });
  }

  async function collectShandong(latests) {
    var text = '';
    for (var index = 0; index < SD_SOURCES.length; index++) {
      var source = SD_SOURCES[index];
      var collected = 0;

      for (var i = 0; i < 17 && collected < 7; i++) {
        var date = beijingDateString(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
        var infos = await fetchIqilu(source.cateid, date);
        if (!infos.length || !infos[0].media || !infos[0].media[0]) continue;

        var url = infos[0].media[0].url;
        if (collected === 0) {
          latests.push({
            text: '#EXTINF:-1 group-title="最新天气",' +
              source.name + date.slice(-2) + '日' + source.time + '\n' + url,
            pubDate: date + 'T' + source.time + ':00.000+08:00'
          });
        }

        text += '\n#EXTINF:-1 group-title="' + source.name + '",' +
          date.slice(-5).replace('-', '月') + '日' + source.time + '\n' + url;
        collected++;
      }
    }
    return text;
  }

  async function collectCentral(latests) {
    var text = '';
    for (var i = 0; i < WEATHER_PAGES.length; i++) {
      var page = WEATHER_PAGES[i];
      var groupName = WEATHER_GROUPS[i];
      var data = await loadWeatherJsonp(page);
      var items = data && data.data ? data.data : [];
      if (!items.length) continue;

      if (groupName !== '中央四') {
        var tvgName = groupName + items[0].pubDate.slice(-11, -3).replace(' ', '日');
        latests.push({
          text: '#EXTINF:-1 group-title="最新天气",' + tvgName + '\n' + items[0].url,
          pubDate: items[0].pubDate.replace(' ', 'T') + '.000+08:00'
        });
      }

      var playlist = items.map(function (item, index) {
        var titled = item.pubDate.slice(-14, -3).replace('-', '月').replace(' ', '日');

        if (item.title === '《天气预报》04:54') {
          if (index < 3) {
            latests.push({
              text: '#EXTINF:-1 group-title="最新天气",北半球' + titled.slice(-8, -5) + '04:54\n' + item.url,
              pubDate: item.pubDate.slice(-19, -8).replace(' ', 'T') + '04:54:00.000+08:00'
            });
          }
          return '#EXTINF:-1 group-title="北半球气象",' +
            item.pubDate.slice(-14, -8).replace('-', '月').replace(' ', '日') + '04:54\n' + item.url;
        }

        if (item.title === '《天气预报》12:54') {
          if (index < 3) {
            latests.push({
              text: '#EXTINF:-1 group-title="最新天气",中央四午' + titled.slice(-8, -5) + '12:54\n' + item.url,
              pubDate: item.pubDate.slice(-19, -8).replace(' ', 'T') + '12:54:00.000+08:00'
            });
          }
          return '#EXTINF:-1 group-title="中央四午",' +
            item.pubDate.slice(-14, -8).replace('-', '月').replace(' ', '日') + '12:54\n' + item.url;
        }

        if (item.title === '《天气预报》21:58') {
          if (index < 3) {
            latests.push({
              text: '#EXTINF:-1 group-title="最新天气",中央四晚' + titled.slice(-8, -5) + '21:58\n' + item.url,
              pubDate: item.pubDate.slice(-19, -8).replace(' ', 'T') + '21:58:00.000+08:00'
            });
          }
          return '#EXTINF:-1 group-title="中央四晚",' +
            item.pubDate.slice(-14, -8).replace('-', '月').replace(' ', '日') + '21:58\n' + item.url;
        }

        return '#EXTINF:-1 group-title="' + groupName + '",' + titled + '\n' + item.url;
      }).join('\n');

      text += '\n' + playlist;
    }
    return text;
  }

  async function generateWeatherM3U() {
    var latests = [];
    var body = await collectShandong(latests);
    body += await collectCentral(latests);

    latests.sort(function (a, b) {
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    return '#EXTM3U\n' + latests.map(function (item) { return item.text; }).join('\n') + body;
  }

  function createProvider() {
    return async function weatherLive() {
      var text = await generateWeatherM3U();
      return {
        text: text,
        baseUrl: root.location ? root.location.href : '',
        lastModified: new Date().toUTCString()
      };
    };
  }

  return {
    generateWeatherM3U: generateWeatherM3U,
    createProvider: createProvider,
    isoDateByOffset: isoDateByOffset
  };
});
