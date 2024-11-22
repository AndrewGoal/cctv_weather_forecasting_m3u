# cctv_weather_forecasting_m3u
cctv 中央电视台 天气预报 气象分析 m3u文件生成

## 数据源
1. https://www.weather.com.cn/video/ylist.shtml
2. https://m.weibo.cn/u/1969156553

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

### 食用m3u文件：
- VLC播放器：⌘ + n 以上m3u网址
- IINA播放器：⇧ + ⌘ + o 以上m3u网址
- 智能电视或电视盒子上利用[TVBoxOSC 20240819-1117版](https://github.com/o0HalfLife0o/TVBoxOSC/releases/tag/20240819-1117)，通过如图设置（并设置启动app直接进入直播），可作为专用的天气预报、气象分析电视app，效果如图：

![设置](tvset.jpeg)
![效果](tv.jpeg)

### 微信打赏🙏：
![微信打赏](wxds.JPG)

### 有待完成
✅ 数据源1的农业气象视频不再更新，需要 ~~利用[爬虫](https://github.com/dataabc/weibo-crawler)，~~ 从数据源2——农业气象微博上获取，并生成到m3u文件中
