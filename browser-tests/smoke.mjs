import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {chromium} from "playwright";

const root=resolve("dist");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".webmanifest":"application/manifest+json"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||"/","http://127.0.0.1");
  const requested=url.pathname==="/"?"/index.html":decodeURIComponent(url.pathname);
  const file=resolve(root,"."+requested);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);
  res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream","cache-control":"no-store"});
  res.end(body);
 }catch{res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const origin="http://127.0.0.1:"+server.address().port;
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:"block"});
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto(origin,{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#data-status")?.textContent.includes("240"));
 assert.equal(await page.locator("[data-mode]").count(),7);
 assert.equal(await page.locator("[data-mode^='daily-']:not(:disabled)").count(),3);
 await page.locator('[data-mode="tournament"]').click();
 assert.equal(await page.locator("#select").evaluate(el=>el.classList.contains("active")),true);
 await page.locator("#select [data-back]").click();
 for(const [year,count] of [[2002,32],[2006,32],[2010,32],[2014,32],[2018,32],[2022,32],[2026,48]]){
  await page.locator('[data-mode="easy"]').click();
  await page.locator("#year").selectOption(String(year));
  assert.equal(await page.locator(".team-button").count(),count,year+" must expose every team");
  await page.locator("#select [data-back]").click();
 }
 const openTeam=async(mode,year,name)=>{
  await page.locator('[data-mode="'+mode+'"]').click();
  await page.locator("#year").selectOption(String(year));
  await page.locator("#team-grid .team-button").getByText(name,{exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll(".player-card").length>0);
 };
 const giveUp=async()=>{
  await page.locator("#give-up").click();
  await page.waitForFunction(()=>!document.querySelector("#result").classList.contains("hidden"));
 };
 await openTeam("easy",2018,"Argentina");
 assert.equal(await page.locator(".player-card").count(),23);
 assert.equal(await page.locator("#guess").isEnabled(),true);
 await page.locator("#guess").fill("Messi");await page.locator("#guess").press("Enter");
 await page.waitForFunction(()=>document.querySelector("#score").textContent==="1");
 await page.locator("#guess").fill("Di Maria");await page.locator("#guess").press("Enter");
 await page.waitForFunction(()=>document.querySelector("#score").textContent==="2");
 await page.locator("#guess").fill("Messi");await page.locator("#guess").press("Enter");
 assert.match(await page.locator("#feedback").textContent(),/Already found/);
 await page.locator("#guess").fill("not a player");await page.locator("#guess").press("Enter");
 assert.match(await page.locator("#feedback").textContent(),/Not in this squad/);
 await giveUp();
 assert.equal((await page.locator("#result-score").textContent()).trim(),"2 / 23");
 assert.equal(await page.locator(".player-card.missed").count(),21);
 await page.locator("#result-home").click();
 await page.locator('[data-open-screen="stats"]').click();
 assert.equal((await page.locator("#local-played").textContent()).trim(),"1");
 assert.equal((await page.locator("#local-found").textContent()).trim(),"2");
 assert.equal((await page.locator("#local-best").textContent()).trim(),"9%");
 await page.locator("#stats [data-back]").click();
 await openTeam("hard",2018,"Argentina");
 assert.equal((await page.locator(".player-hint").first().textContent()).trim(),"HIDDEN PLAYER");
 await page.locator("#guess").fill("Messi");await page.locator("#guess").press("Enter");
 await page.waitForFunction(()=>document.querySelector(".player-card.found .player-name")?.textContent==="Lionel Messi");
 assert.equal((await page.locator(".player-card.found .player-hint").textContent()).trim(),"FOUND");
 await giveUp();await page.locator("#result-home").click();
 await openTeam("practice",2018,"Argentina");
 assert.equal((await page.locator("#timer").textContent()).trim(),"∞");
 await page.waitForTimeout(1200);
 assert.equal((await page.locator("#timer").textContent()).trim(),"∞");
 await giveUp();await page.locator("#result-home").click();
 const dailyStart=async tier=>{
  await page.locator('[data-mode="daily-'+tier+'"]').click();
  await page.waitForFunction(()=>document.querySelector("#game").classList.contains("active"));
  assert.ok(await page.locator(".player-card").count()>0,"Daily must load a squad");
 };
 await dailyStart("common");
 const dailyFirstTeam=(await page.locator("#game-team").textContent()).trim();
 assert.notEqual((await page.locator(".player-hint").first().textContent()).trim(),"HIDDEN PLAYER");
 for(let round=0;round<3;round++){await giveUp();if(round<2)await page.locator("#result-home").click();}
 await page.locator("#result-home").click();
 assert.match(await page.locator("#result-message").textContent(),/Three local squads played/);
 await page.locator("#result-home").click();
 await page.locator('[data-open-screen="stats"]').click();
 assert.equal((await page.locator("#local-played").textContent()).trim(),"4");
 await page.locator("#stats [data-back]").click();
 await page.reload({waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#data-status")?.textContent.includes("240"));
 await page.locator('[data-open-screen="stats"]').click();
 assert.equal((await page.locator("#local-played").textContent()).trim(),"4","local stats must survive a reload");
 await page.locator("#stats [data-back]").click();
 await dailyStart("common");
 assert.equal((await page.locator("#game-team").textContent()).trim(),dailyFirstTeam);
 await page.locator("#game [data-back]").click();
 await dailyStart("niche");
 for(let round=0;round<3;round++){await giveUp();if(round<2)await page.locator("#result-home").click();}
 await page.locator("#result-home").click();
 await page.locator("#result-home").click();
 await dailyStart("legendary");
 assert.equal((await page.locator(".player-hint").first().textContent()).trim(),"HIDDEN PLAYER");
 for(let round=0;round<3;round++){await giveUp();if(round<2)await page.locator("#result-home").click();}
 await page.locator("#result-home").click();
 await page.locator("#result-home").click();
 await openTeam("easy",2026,"England");
 assert.equal(await page.locator(".player-card").count(),26);
 assert.match(await page.locator(".player-hint").first().textContent(),/GK · Everton FC/);
 await giveUp();await page.locator("#result-home").click();
 await page.locator('[data-open-screen="settings"]').click();
 await page.locator("#setting-compact").check();
 await page.locator("#setting-motion").check();
 await page.locator("#save-settings").click();
 assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("compact-ui")),true);
 assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("reduce-motion")),true);
 await page.locator("#settings [data-back]").click();
 await page.locator('[data-open-screen="stats"]').click();
 await page.locator("#clear-local-stats").click();
 assert.equal((await page.locator("#local-played").textContent()).trim(),"0");
 assert.equal((await page.locator("#local-found").textContent()).trim(),"0");
 assert.deepEqual(errors,[],"mobile gameplay must not throw runtime errors");
 await context.close();

 const timerContext=await browser.newContext({viewport:{width:390,height:844}});
 const timerPage=await timerContext.newPage();
 const timerErrors=[];
 timerPage.on("pageerror",error=>timerErrors.push(error.message));
 await timerPage.clock.install();
 await timerPage.goto(origin,{waitUntil:"domcontentloaded"});
 await timerPage.waitForFunction(()=>document.querySelector("#data-status")?.textContent.includes("240"));
 await timerPage.locator('[data-mode="easy"]').click();
 await timerPage.locator("#year").selectOption("2018");
 await timerPage.locator(".team-button").filter({hasText:/^Argentina\b/}).click();
 await timerPage.clock.runFor(120_000);
 await timerPage.waitForFunction(()=>!document.querySelector("#result").classList.contains("hidden"));
 assert.match(await timerPage.locator("#result-message").textContent(),/Time is up/);
 assert.equal(await timerPage.locator(".player-card.missed").count(),23);
 assert.deepEqual(timerErrors,[]);
 await timerContext.close();

 const offlineContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"allow"});
 const offlinePage=await offlineContext.newPage();
 const offlineErrors=[];
 offlinePage.on("pageerror",error=>offlineErrors.push(error.message));
 await offlinePage.goto(origin,{waitUntil:"domcontentloaded"});
 await offlinePage.waitForFunction(()=>document.querySelector("#data-status")?.textContent.includes("240"));
 await offlinePage.evaluate(()=>navigator.serviceWorker.ready);
 await offlinePage.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await offlineContext.setOffline(true);
 await offlinePage.reload({waitUntil:"domcontentloaded"});
 await offlinePage.waitForFunction(()=>document.querySelector("#data-status")?.textContent.includes("240"));
 await offlinePage.locator('[data-mode="easy"]').click();
 await offlinePage.locator("#year").selectOption("2018");
 await offlinePage.locator(".team-button").filter({hasText:/^Argentina\b/}).click();
 await offlinePage.locator("#guess").fill("Messi");await offlinePage.locator("#guess").press("Enter");
 await offlinePage.waitForFunction(()=>document.querySelector("#score").textContent==="1");
 assert.deepEqual(offlineErrors,[],"cached app must run after an offline reload");
 await offlineContext.close();
 console.log("Browser smoke suite passed: all teams, mobile gameplay, every mode, results, timer, stats, settings and offline reload.");
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
