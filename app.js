(async () => {
    // return
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

    let reswb = await fetch("https://m.weibo.cn/api/container/getIndex?luicode=10000011&lfid=1005051969156553&type=uid&value=1969156553&containerid=1076031969156553", {
        "headers": {
          "accept": "application/json, text/plain, */*",
          "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
          "cache-control": "no-cache",
          "mweibo-pwa": "1",
          "pragma": "no-cache",
          "priority": "u=1, i",
          "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"macOS\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
          "x-xsrf-token": "02e996",
          "cookie": "_T_WM=26681150684; MLOGIN=0; WEIBOCN_FROM=1110106030; XSRF-TOKEN=02e996; mweibo_short_token=c86832c9b3; M_WEIBOCN_PARAMS=luicode%3D10000011%26lfid%3D1005051969156553%26oid%3D5103586063945698%26fid%3D1005051969156553%26uicode%3D10000011",
          "Referer": "https://m.weibo.cn/u/1969156553?luicode=10000011&lfid=1005051969156553",
          "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": null,
        "method": "GET"
      });

      let json = await reswb.json();

      json.data.cards.forEach((card,index) => {
        let duration = card.mblog.page_info.media_info.duration
        let datewb = new Date(card.mblog.created_at)
        let url = card.mblog.page_info.urls.mp4_720p_mp4

        if (card.card_type !== 9) return;
        if (index == 0){
            console.log(`#EXTINF:${duration} group-title="最新天气",农业气象${datewb.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })}\n${url}`);
        }
        console.log(`#EXTINF:${duration} group-title="农业气象",${datewb.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '月').replace(/ /g, '日')}\n${url}`);
        
      });


    
})();


