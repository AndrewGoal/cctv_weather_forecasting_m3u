# ☁️☀️气象万千⛈️🌈天气预报❄️气象分析⚡️电视播放m3u列表
cctv 中央电视台 山东卫视 山东新闻 天气预报 气象分析 m3u文件生成

- [☁️☀️气象万千⛈️🌈天气预报❄️气象分析⚡️电视播放m3u列表](#️️气象万千️天气预报️气象分析️电视播放m3u列表)
  - [数据源](#数据源)
  - [生成和使用天气预报m3u文件](#生成和使用天气预报m3u文件)
    - [样例：](#样例)
    - [本地运行：](#本地运行)
    - [在线获取最新的m3u文件：](#在线获取最新的m3u文件)
    - [在线演示器（推荐）](#在线演示器推荐)
    - [食用m3u文件：](#食用m3u文件)
    - [微信打赏🙏：](#微信打赏)
    - [有待完成](#有待完成)


## 数据源
1. https://www.weather.com.cn/video/ylist.shtml
2. [~~农业气象~~，需登录，放弃](https://m.weibo.cn/u/1969156553)
3. https://sdxw.iqilu.com/share/dHYtMjEtNTYyNjU0OQ.html#/
4. https://sdxw.iqilu.com/share/dHYtMjEtNTYyNTg5MQ.html#/

## 生成和使用天气预报m3u文件

### 样例：
[tq.m3u](tq.m3u)

### 本地运行：
```bash
node app.js > tq.m3u
```

### 在线获取最新的m3u文件：

[![生成天气m3u文件](https://github.com/AndrewGoal/cctv_weather_forecasting_m3u/actions/workflows/main.yml/badge.svg)](https://github.com/AndrewGoal/cctv_weather_forecasting_m3u/actions/workflows/main.yml)

每半小时生成一次，最新版下载网址：

- https://github.com/AndrewGoal/cctv_weather_forecasting_m3u/releases/latest/download/cctv_weather_forecasting.m3u
- 墙内：https://github.moeyy.xyz/https://github.com/AndrewGoal/cctv_weather_forecasting_m3u/releases/latest/download/cctv_weather_forecasting.m3u

### 在线演示器（推荐）

[![在线演示](https://img.shields.io/badge/▶%20在线演示-打开天气播放器-2ea6ff?style=for-the-badge)](https://andrewgoal.github.io/cctv_weather_forecasting_m3u/)

[![在线演示器截图：左侧为电脑端界面，右侧为手机端界面](demo.jpg)](https://andrewgoal.github.io/cctv_weather_forecasting_m3u/)

- 打开页面即自动加载**最新** m3u，无需手动导入；GitHub Actions 每 30 分钟生成 m3u 并同步部署演示页
- 打开页面即自动播放；浏览器限制「带声音自动播放」时，会先静音播放并提示，点击页面任意处即可开启声音
- 无广告、无统计，深色界面，手机 / 平板 / 电视浏览器均可使用
- 「最新天气」自动置顶，支持栏目筛选、搜索、自动连播、断网时使用上次缓存
- 播放中每 30 分钟自动检查更新，刷新节目单不会打断当前播放

> GitHub 的 README 页面出于安全限制不能嵌入 iframe，所以上面是跳转链接。如果你有自己的网页，可以直接嵌入播放器：

```html
<iframe
  src="https://andrewgoal.github.io/cctv_weather_forecasting_m3u/?embed=1"
  title="气象万千 · 天气预报表"
  style="width:100%;aspect-ratio:16/10;min-height:560px;border:0;border-radius:16px"
  allow="autoplay; fullscreen; picture-in-picture"
  allowfullscreen
  loading="lazy"></iframe>
```

嵌入模式与可选参数：

| 参数 | 说明 | 示例 |
| --- | --- | --- |
| `embed=1` | 隐藏页头页脚，适合 iframe 嵌入 | `?embed=1` |
| `group=山东早` | 默认打开指定栏目 | `?group=山东早` |
| `autoplay=0` | 关闭打开页面时的自动播放（默认开启） | `?autoplay=0` |
| `autoplay=muted` | 打开后直接静音自动播放，不尝试有声播放 | `?autoplay=muted` |
| `m3u=<地址>` | 使用自定义 m3u（该地址需允许跨域） | `?m3u=https://example.com/tq.m3u` |
| `refresh=60` | 自动检查更新的间隔，单位分钟，默认 30 | `?refresh=60` |

> 浏览器策略不允许网页在没有用户交互的情况下**带声音**自动播放，因此播放器会先尝试有声播放，被拦截时自动降级为静音播放；用户点击页面任意处后立即开启声音。如果浏览器本身允许（例如站点已添加到主屏幕/安装为应用，或浏览器配置了免手势自动播放策略），则可以直接有声自动播放。

嵌入页面与父页面之间也可以通信：播放器会发送 `cwp:ready`、`cwp:change`、`cwp:playing` 消息；父页面可发送 `{ type: "cwp:refresh" }` 刷新节目单，或 `{ type: "cwp:play", url: "视频地址" }` 直接播放某个节目。

演示页源码在 [`index.html`](index.html) 和 [`player/`](player/) 目录，由 [GitHub Actions](.github/workflows/main.yml) 在每次生成 m3u 后自动部署到 GitHub Pages。如果 `github.io` 访问不畅，也可以把这几个静态文件放到自己的服务器或对象存储，通过 `?m3u=` 指向加速后的 m3u 地址。

### 食用m3u文件：

- **在线演示（推荐）**：[andrewgoal.github.io/cctv\_weather\_forecasting\_m3u](https://andrewgoal.github.io/cctv_weather_forecasting_m3u/)（自动加载最新 m3u、无广告）
- **旧版演示**：[iptvplayer.stream](https://iptvplayer.stream/import/evgAthl7uR)（不会自动更新，广告较多）
- Mac/iOS平台：[APTV](https://apps.apple.com/tw/app/aptv/id1630403500)
- VLC播放器：⌘ + n 以上m3u网址
- IINA播放器：⇧ + ⌘ + o 以上m3u网址
- 智能电视或电视盒子上利用[TVBoxOSC 20240819-1117版](https://github.com/o0HalfLife0o/TVBoxOSC/releases/tag/20240819-1117)，通过如图设置（并设置启动app直接进入直播），可作为专用的天气预报、气象分析电视app，效果如图：

![设置](tvset.jpeg)
![缩放设置](tvboxZoomSet.jpg)
![效果](tv.jpeg)

### 微信打赏🙏：
![微信打赏](wxds.JPG)

### 有待完成
- ✅ 数据源1的农业气象视频不再更新，需要 ~~利用[爬虫](https://github.com/dataabc/weibo-crawler)，~~ 从数据源2——农业气象微博上获取，并生成到m3u文件中
- ✅ 数据源3、4
