'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// 在 require 之前注入最小浏览器环境，Provider 会在加载时捕获 globalThis。
globalThis.fetch = async function (url) {
  assert.match(url, /sdxw\.iqilu\.com/);
  return {
    ok: true,
    status: 200,
    json: async () => ({
      code: 1,
      data: {
        infos: [{ media: [{ url: 'https://iqilu.test/video.mp4' }] }]
      }
    })
  };
};

const head = {
  appendChild(script) {
    script.parentNode = this;
    const page = String(script.src).match(/\/pubm\/([a-z0-9_]+)\.htm/)?.[1] || '';
    // 模拟天气网脚本同步调用写死的全局回调
    queueMicrotask(() => {
      if (typeof globalThis.getLbDatas === 'function') {
        globalThis.getLbDatas({
          data: [{
            url: 'https://vod.test/' + page + '.mp4',
            pubDate: '2026-11-23 20:17:40',
            title: '新闻联播天气预报20261123'
          }]
        });
      }
    });
  },
  removeChild(script) {
    script.parentNode = null;
  }
};

globalThis.document = {
  head,
  createElement(tag) {
    assert.equal(tag, 'script');
    return {
      src: '',
      async: false,
      parentNode: null,
      onerror: null,
      remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
      }
    };
  }
};

const { generateWeatherM3U, isoDateByOffset } = require('../weather-provider.js');

test('北京时间日期辅助函数', () => {
  assert.equal(
    isoDateByOffset(new Date('2026-11-23T00:00:00.000Z'), -480),
    '2026-11-23T08:00:00.000+08:00'
  );
});

test('浏览器 Provider 生成可解析的 m3u 文本', async () => {
  const text = await generateWeatherM3U();

  assert.match(text, /^#EXTM3U\n/);
  assert.match(text, /group-title="最新天气"/);
  assert.match(text, /group-title="山东晚"/);
  assert.match(text, /group-title="山东早"/);
  assert.match(text, /group-title="七点半"/);
  assert.match(text, /group-title="中央四"/);
  assert.match(text, /https:\/\/iqilu\.test\/video\.mp4/);
  assert.match(text, /https:\/\/vod\.test\/video_lianbo_2021\.mp4/);

  // 最新天气必须排在最前面
  assert.match(text, /^#EXTM3U\n#EXTINF:-1 group-title="最新天气",/);
});
