(async () => {

    let urls = [
        'https://www.weather.com.cn/pubm/video_lianbo_2021.htm',
        'https://www.weather.com.cn/pubm/zhaowen.htm',
        'https://www.weather.com.cn/pubm/wujian.htm',
        'https://www.weather.com.cn/pubm/diyiyinxiang.htm',
        'https://www.weather.com.cn/pubm/cctv4.htm',
        'https://www.weather.com.cn/pubm/tiyu.htm',
        'https://www.weather.com.cn/pubm/cctv7.htm',
        'https://www.weather.com.cn/pubm/cgtn.htm'
    ];
    
    let group_names = [
        '中央一晚',
        '中央一早',
        '中央一午',
        '中央二早',
        '中央四',
        '中央五',
        '中央七',
        '英文台'
    ];
    
    console.log(`#EXTM3U`);
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const group_name = group_names[i];
    
        let res = await fetch(`${url}?callback=getLbDatas&_=${Date.now()}`, {
            "headers": {
              "accept": "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01",
              "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
              "cache-control": "no-cache",
              "pragma": "no-cache",
              "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": "\"macOS\"",
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
              "x-requested-with": "XMLHttpRequest",
              "cookie": "HttpOnly; userNewsPort0=1; defaultCty=101120201; defaultCtyName=%u9752%u5C9B; f_city=%E9%9D%92%E5%B2%9B%7C101120201%7C",
              "Referer": "https://www.weather.com.cn/video/ylist.shtml",
              "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            "body": null,
            "method": "GET"
        });
        let text = await res.text();
        let data = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')));
        // console.log(data);
        
        let tvg_name = `${group_name}${data.data[0].pubDate.slice(-8,-3)}`;
        // console.log(`#EXTINF:-1 tvg-name="${tvg_name}" group-title="最新天气",${tvg_name}\n${data.data[0].url}`);
        console.log(`#EXTINF:-1 group-title="最新天气",${tvg_name}\n${data.data[0].url}`);
        
        const playlist = data.data.map((item,index) => {
            let _tvg_name = item.pubDate.slice(-14,-3).replace('-','月').replace(' ','日');
            // return `#EXTINF:-1 tvg-name="${group_name}${_tvg_name}" group-title="${group_name}",${_tvg_name}\n${item.url}`
            return `#EXTINF:-1 group-title="${group_name}",${_tvg_name}\n${item.url}`
        }).join('\n');
            
        console.log(playlist);
        
    }
    
})();


