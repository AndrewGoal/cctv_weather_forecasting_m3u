// https://www.weathertv.cn/cms/yb_video.shtml
const puppeteer = require('puppeteer');

(async () => {

  let latestUrl

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const baseUrl='https://www.weathertv.cn';
  await page.goto(`${baseUrl}/cms/yb_video.shtml`, { waitUntil: 'networkidle2' });
//   const links = await page.$$('#ylist > li > div > div.img-box > a');
  const links = await page.$$('#ylist > li > div > p > a');
//   console.log(links);
  if (links.length>0) {
    console.log(`#EXTM3U`);
    // console.log(`#EXTM3U x-tvg-url="https://live.fanmingming.com/e.xml"`);
  }
    
  for (let i = 0; i < links.length; i++) {
    // for (let i = 0; i < 1; i++) {
    const link = links[i];
    const href = await page.evaluate(el => el.getAttribute('href'), link);
    const text = await page.evaluate(el => el.innerText, link);
    let urlOf1Date =`${baseUrl}${href}`; 
    
    const page1 = await browser.newPage();
    await page1.goto(urlOf1Date, { waitUntil: 'networkidle2' });
    const videoElement = await page1.$('video source');
    const videoUrl = await page1.evaluate(el => el.getAttribute('src'), videoElement);
    if (i==0) latestUrl = videoUrl;
    // await page1.close();

    // console.log({ href, videoUrl });
    const date = text.replace('新闻联播天气预报', '').replace(/(\d{4})(\d{2})(\d{2})/, '$1年$2月$3日');
    // // console.log({date, videoUrl});

    // console.log({date, urlOf1Date,videoUrl});

    console.log(`#EXTINF:-1 tvg-name="CCTV_WF_${date}" tvg-logo="https://live.fanmingming.com/tv/CCTV1.png" group-title="天气预报",${date}\n${videoUrl}`);
  }
  await browser.close();
})();


