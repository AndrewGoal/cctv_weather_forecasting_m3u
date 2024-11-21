# cctv_weather_forecasting_m3u
cctv 中央电视台 天气预报 m3u文件生成

## 数据源

### 背景介绍
[维基百科：新闻联播天气预报](https://zh.wikipedia.org/zh-tw/%E6%96%B0%E9%97%BB%E8%81%94%E6%92%AD%E5%A4%A9%E6%B0%94%E9%A2%84%E6%8A%A5)

### 网页数据源
- https://www.weathertv.cn/cms/yb_video.shtml
- https://www.weather.com.cn/video/ylist.shtml

### 以上网页内的JSON数据源
用这个地址，不用爬网页：
```
curl 'https://e.weather.com.cn/pubm/video_lianbo_2021.htm'
```

## 生成和使用天气预报m3u文件

### 样例：
[tq.m3u](tq.m3u)

### 本地运行：
```bash
npm install
node app.js > tq.m3u

#或者：

docker run -i --init --cap-add=SYS_ADMIN --rm ghcr.io/puppeteer/puppeteer:latest node -e "$(cat app.js)" > tq.m3u
```

### 也可以直接获取最新的m3u8文件：

[![生成天气预报m3u8文件](https://github.com/AndrewGoal/cctv_weather_forecasting_m3u/actions/workflows/main.yml/badge.svg)](https://github.com/AndrewGoal/cctv_weather_forecasting_m3u/actions/workflows/main.yml)

https://github.com/AndrewGoal/cctv_weather_forecasting_m3u/actions/runs/11941264291/artifacts/2215342389

https://github.com/AndrewGoal/cctv_weather_forecasting_m3u/actions/runs/11941274767/artifacts/2215345549

### 食用m3u文件：
- VLC播放器
- IINA播放器
- [TVBoxOSC 20240819-1117版](https://github.com/o0HalfLife0o/TVBoxOSC/releases/tag/20240819-1117)