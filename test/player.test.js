'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseM3U, groupItems, parseTitleDate, toHttps, hashText } = require('../player/playlist.js');

test('解析标准 EXTINF 属性、标题与时长', () => {
  const items = parseM3U([
    '#EXTM3U',
    '#EXTINF:-1 group-title="最新天气" tvg-id="cctv2",中央二早25日08:42',
    'https://vod.weathertv.cn/video/2025/11/25/a.mp4',
    '#EXTINF:81.13 group-title="农业气象",农业气象24日19:38',
    'https://f.video.weibocdn.com/o0/b.mp4?label=mp4_720p&Expires=1',
  ].join('\n'));

  assert.equal(items.length, 2);
  assert.equal(items[0].group, '最新天气');
  assert.equal(items[0].title, '中央二早25日08:42');
  assert.equal(items[0].duration, null);
  assert.equal(items[0].attrs['tvg-id'], 'cctv2');
  assert.equal(items[1].duration, 81.13);
  assert.equal(items[1].url, 'https://f.video.weibocdn.com/o0/b.mp4?label=mp4_720p&Expires=1');
});

test('兼容 BOM、CRLF、空行、注释与 #EXTGRP', () => {
  const items = parseM3U(
    '\uFEFF#EXTM3U\r\n# 注释行\r\n#EXTINF:-1,节目A\r\n#EXTGRP:山东晚\r\nhttp://stream4.iqilu.com/a.mp4\r\n\r\n'
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].group, '山东晚');
  assert.equal(items[0].playUrl, 'https://stream4.iqilu.com/a.mp4');
});

test('标题内的逗号不会被截断', () => {
  const items = parseM3U('#EXTINF:-1 group-title="测试",中央四晚, 特别节目 24日21:58\nhttps://example.com/a.mp4');
  assert.equal(items[0].title, '中央四晚, 特别节目 24日21:58');
});

test('解析相对地址并支持裸 URL', () => {
  const items = parseM3U('https://cdn.example.com/live/index.m3u8', { baseUrl: 'https://example.com/list/a.m3u' });
  assert.equal(items[0].url, 'https://cdn.example.com/live/index.m3u8');
  assert.equal(items[0].title, 'index.m3u8');
  assert.equal(items[0].group, '未分组');
});

test('toHttps 只升级 http', () => {
  assert.equal(toHttps('http://stream5.iqilu.com/a.mp4'), 'https://stream5.iqilu.com/a.mp4');
  assert.equal(toHttps('https://vod.weathertv.cn/a.mp4'), 'https://vod.weathertv.cn/a.mp4');
  assert.equal(toHttps('rtsp://example.com/a'), 'rtsp://example.com/a');
});

test('解析标题中的北京时间', () => {
  const now = new Date('2026-11-25T09:00:00+08:00');
  assert.equal(parseTitleDate('中央二早25日08:42', now).toISOString(), '2026-11-25T00:42:00.000Z');
  assert.equal(parseTitleDate('11月24日19:31天气', now).toISOString(), '2026-11-24T11:31:00.000Z');
  assert.equal(parseTitleDate('2026-11-25 08:42', now).toISOString(), '2026-11-25T00:42:00.000Z');
  // 只有「日」且明显晚于当前时间（如跨月）时回退到上个月
  assert.equal(parseTitleDate('农业气象28日19:38', new Date('2026-12-01T09:00:00+08:00')).toISOString(), '2026-11-28T11:38:00.000Z');
  assert.equal(parseTitleDate('没有时间的节目', now), null);
});

test('分组保持首次出现顺序', () => {
  const items = parseM3U([
    '#EXTINF:-1 group-title="B",b1', 'https://e.com/1',
    '#EXTINF:-1 group-title="A",a1', 'https://e.com/2',
    '#EXTINF:-1 group-title="B",b2', 'https://e.com/3',
  ].join('\n'));
  const groups = groupItems(items);
  assert.deepEqual(groups.map((g) => g.name), ['B', 'A']);
  assert.equal(groups[0].items.length, 2);
});

test('hashText 对内容变化敏感', () => {
  assert.equal(hashText('abc'), hashText('abc'));
  assert.notEqual(hashText('abc'), hashText('abd'));
});
