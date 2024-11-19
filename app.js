// https://www.weathertv.cn/cms/yb_video.shtml
const puppeteer = require('puppeteer');

(async () => {

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const baseUrl='https://www.weathertv.cn';
  await page.goto(`${baseUrl}/cms/yb_video.shtml`, { waitUntil: 'networkidle2' });
//   const links = await page.$$('#ylist > li > div > div.img-box > a');
  const links = await page.$$('#ylist > li > div > p > a');
//   console.log(links);
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const href = await page.evaluate(el => el.getAttribute('href'), link);
    const text = await page.evaluate(el => el.innerText, link);
    let urlOf1Date =`${baseUrl}${href}`; 
    
    const page1 = await browser.newPage();
    await page1.goto(urlOf1Date, { waitUntil: 'networkidle2' });
    const videoElement = await page1.$('video source');
    const videoUrl = await page1.evaluate(el => el.getAttribute('src'), videoElement);
    await page1.close();

    // console.log({ href, videoUrl });
    const date = text.replace('新闻联播天气预报', '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    // // console.log({date, videoUrl});

    // console.log({date, urlOf1Date,videoUrl});


    console.log(`#EXTINF:-1,${date}\n${videoUrl}\n`);
    // page.goBack();
  }
  await browser.close();
})();


