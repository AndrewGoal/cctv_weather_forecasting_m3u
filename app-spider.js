// spider方式爬取，废弃

// 使用方法：
// npm install
// node app-spider.js > tq.m3u

// 或者：
// docker run -i --init --cap-add=SYS_ADMIN --rm ghcr.io/puppeteer/puppeteer:latest node -e "$(cat app-spider.js)" > tq.m3u

// 数据源：
// https://www.weathertv.cn/cms/yb_video.shtml

const puppeteer = require('puppeteer');

(async () => {

  let latestUrl,latestDate;

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const baseUrl='https://www.weathertv.cn';
  await page.goto(`${baseUrl}/cms/yb_video.shtml`, { waitUntil: 'networkidle2' });
  let links;
  while (true) {
    links = await page.$$('#ylist > li > div > p > a');
    if (links.length>0) break;
    await page.reload();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log(`#EXTM3U`);
  // console.log(`#EXTM3U x-tvg-url="https://live.fanmingming.com/e.xml"`);
    
  for (let i = 0; i < links.length; i++) {
    // for (let i = 0; i < 1; i++) {
    const link = links[i];
    const href = await page.evaluate(el => el.getAttribute('href'), link);
    const text = await page.evaluate(el => el.innerText, link);
    let urlOf1Date =`${baseUrl}${href}`; 
    
    const page1 = await browser.newPage();
    await page1.goto(urlOf1Date, { waitUntil: 'networkidle2' });
    const videoElement = await page1.$('video source');
    const videoUrl = await page1.evaluate(el => el?.getAttribute('src'), videoElement);
    // await page1.close();

    // console.log({ href, videoUrl });
    const date1 = text.replace('新闻联播天气预报', '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    const date = text.replace('新闻联播天气预报', '').replace(/(\d{4})(\d{2})(\d{2})/, '$2月$3日');
    if (i==0) {
      latestUrl = videoUrl;
      latestDate = date;
    }
    // // console.log({date, videoUrl});

    // console.log({date, urlOf1Date,videoUrl});

    if (videoUrl) {
      console.log(
`#EXTINF:-1 group-title="19:30预报",${date}
${videoUrl}`
      );      
    }
  }

  if (latestUrl) {
    console.log(
`#EXTINF:-1 group-title="最新天气",${latestDate}19:30
${latestUrl}`
    );
  }

  await browser.close();
})();


