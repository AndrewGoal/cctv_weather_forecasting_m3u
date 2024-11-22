(async () => {

    let urls = [
        'https://www.weather.com.cn/pubm/video_lianbo_2021.htm',
        'https://www.weather.com.cn/pubm/zhaowen.htm',
        'https://www.weather.com.cn/pubm/wujian.htm',
        'https://www.weather.com.cn/pubm/diyiyinxiang.htm',
        'https://www.weather.com.cn/pubm/cctv4.htm',
        'https://www.weather.com.cn/pubm/tiyu.htm',
        'https://www.weather.com.cn/pubm/cctv7.htm',
        // 'https://www.weather.com.cn/pubm/cgtn.htm',
        // 'https://www.weather.com.cn/pubm/nongye.htm'
    ];
    
    let group_names = [
        '中央一晚',
        '中央13早',
        '中央一午',
        '中央二早',
        '中央四',
        '体育天气',
        '中央七',
        // '英语台',
        // '农业气象'
    ];
    
    console.log(`#EXTM3U`);
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const group_name = group_names[i];
        let res = await fetch(`${url}?callback=getLbDatas&_=${Date.now()}`, {
            "cache": "default",
            "credentials": "include",
            "headers": {
                "Accept": "*/*",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1"
            },
            "method": "GET",
            "mode": "cors",
            "redirect": "follow",
            "referrer": "http://www.weather.com.cn/",
            "referrerPolicy": "strict-origin-when-cross-origin"
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


