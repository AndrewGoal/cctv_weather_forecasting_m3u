const { exec } = require('child_process');

const runTimes = 10;
const delayBetweenRuns = 5000; // 每次运行之间的延迟时间，单位为毫秒

async function runScript() {
  for (let i = 0; i < runTimes; i++) {
    console.log(`Running app.js - Iteration ${i + 1}/${runTimes}`);
    exec('node app.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`Iteration ${i + 1} Error executing app.js: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Iteration ${i + 1} stderr: ${stderr}`);
        return;
      }
      console.log(`Iteration ${i + 1} stdout: ${stdout}`);
    });

    if (i < runTimes - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenRuns));
    }
  }
}

runScript();