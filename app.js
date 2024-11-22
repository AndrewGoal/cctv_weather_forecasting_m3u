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

    let latests = [];
    let m3utext = '';
        
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
        if (group_name != '中央四') {

            let tvg_name = `${group_name}${data.data[0].pubDate.slice(-11,-3).replace(' ','日')}`;
            latests.push({text:`#EXTINF:-1 group-title="最新天气",${tvg_name}\n${data.data[0].url}`,pubDate:`${data.data[0].pubDate.replace(' ','T')}.000+08:00`});
                
        } 
        
        const playlist = data.data.map((item,index) => {
            // console.log(item);
            let _tvg_name = item.pubDate.slice(-14,-3).replace('-','月').replace(' ','日');
            if (item.title == '《天气预报》04:54') {
                if (index < 3) {
                    latests.push({text:`#EXTINF:-1 group-title="最新天气",全球气象${_tvg_name.slice(-8,-5)}04:54\n${item.url}`,pubDate:`${item.pubDate.slice(-19,-8).replace(' ','T')}04:54:00.000+08:00`});
                }
                return `#EXTINF:-1 group-title="全球气象",${item.pubDate.slice(-14,-8).replace('-','月').replace(' ','日')}04:54\n${item.url}`                
            }
            if (item.title == '《天气预报》12:54') {
                if (index < 3) {
                    latests.push({text:`#EXTINF:-1 group-title="最新天气",中央四午${_tvg_name.slice(-8,-5)}12:54\n${item.url}`,pubDate:`${item.pubDate.slice(-19,-8).replace(' ','T')}12:54:00.000+08:00`});
                }
                return `#EXTINF:-1 group-title="中央四午",${item.pubDate.slice(-14,-8).replace('-','月').replace(' ','日')}12:54\n${item.url}`                
            }
            if (item.title == '《天气预报》21:58') {
                if (index < 3) {
                    latests.push({text:`#EXTINF:-1 group-title="最新天气",中央四晚${_tvg_name.slice(-8,-5)}21:58\n${item.url}`,pubDate:`${item.pubDate.slice(-19,-8).replace(' ','T')}21:58:00.000+08:00`});
                }
                return `#EXTINF:-1 group-title="中央四晚",${item.pubDate.slice(-14,-8).replace('-','月').replace(' ','日')}21:58\n${item.url}`                
            }
            return `#EXTINF:-1 group-title="${group_name}",${_tvg_name}\n${item.url}`
        }).join('\n');

        m3utext += `\n${playlist}`;     

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
        let datewbISOString = toISODateFMTbyTimezoneOffset(new Date(card.mblog.created_at),-480);
        // console.log(`# ${datewbISOString}`);
        let url = card.mblog.page_info.urls.mp4_720p_mp4

        if (card.card_type !== 9) return;
        if (index == 0){
            latests.push({text:`#EXTINF:${duration} group-title="最新天气",农业气象${datewbISOString.slice(8,16).replace('T','日')}\n${url}`,pubDate:datewbISOString});
        }
        m3utext += `\n#EXTINF:${duration} group-title="农业气象",${datewbISOString.slice(5, 16).replace('-','月').replace('T','日')}\n${url}`

      });
    m3utext = `#EXTM3U\n${latests.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate)).map(item=>item.text).join('\n')}${m3utext}`

    console.log(m3utext);

    
})();



/**
 * 将给定的日期对象转换为带有指定时区偏移的ISO格式日期字符串
 * 
 * @param {Date} date - 需要转换的日期对象
 * @param {number} [timezoneMinuteOffset] - 时区偏移量，以分钟为单位，默认为当前时区偏移，上海所在的东八区为-480
 * @returns {string} - 转换后的ISO格式日期字符串，带有指定的时区偏移
 */
function toISODateFMTbyTimezoneOffset(date, timezoneMinuteOffset) {
    // 如果未提供时区偏移量，则使用当前时区的偏移量
    timezoneMinuteOffset = timezoneMinuteOffset || new Date().getTimezoneOffset();
    
    // 创建一个新的日期对象，该对象根据提供的时区偏移量进行了调整
    // 这里通过将日期的时间设置为1970年1月1日，并应用时区偏移来实现
    const adjustedDate = new Date(date.getTime() + Date.UTC(1970, 0, 1, -timezoneMinuteOffset / 60));
    
    // 将调整后的日期对象转换为ISO格式字符串，并移除末尾的'Z'（表示零时区偏移）
    // 然后根据提供的时区偏移量添加相应的时区偏移到字符串末尾
    return adjustedDate.toISOString()
        .replace('Z', `+${('0' + (timezoneMinuteOffset * -1 / 60)).slice(-2)}:00`);
  }
  
//   console.log(toISODateFMTbyTimezoneOffset(new Date()));
  