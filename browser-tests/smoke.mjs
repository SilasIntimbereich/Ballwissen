import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {chromium} from "playwright";

const root=resolve("dist");
const mime={
 ".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",
 ".svg":"image/svg+xml",".webmanifest":"application/manifest+json"
};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||"/","http://127.0.0.1");
  const requested=url.pathname==="/"?"/index.html":decodeURIComponent(url.pathname);
  const file=resolve(root,"."+requested);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);
  res.writeHead(200,{"content-type":mime[extname(file)]||"application/octet-stream","cache-control":"no-store"});
  res.end(body);
 }catch{
  res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");
 }
});
await new Promise(resolveListen=>server.listen(0,"127.0.0.1",resolveListen));
const address=server.address();
const origin="http://127.0.0.1:"+address.port;
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:"block"});
 const page=await context.newPage();
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto(origin,{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#data-status")?.textContent.includes("240"));
 assert.equal(await page.locator("[data-mode]").count(),7,"all seven game modes must be present");
 assert.equal(await page.locator("[data-mode^='daily-']:not(:disabled)").count(),3,"all three Daily tiers must be playable");
 for(const [year,count] of [[2002,32],[2006,32],[2010,32],[2014,32],[2018,32],[2022,32],[2026,48]]){
  await page.locator('[data-mode="easy"]').click();
  await page.locator("#year").selectOption(String(year));
  assert.equal(await page.locator(".team-button").count(),count,year+" must expose every tournament team");
  await page.locator("[data-back]").first().click();
 }
 const openTeam=async(mode,year,name)=>{
  await page.locator('[data-mode="'+mode+'"]').click();
  await page.locator("#year").selectOption(String(year));
  await page.locator(".team-button").filter({hasText:new RegExp("^"+name+"\\b")}).first().click();
  await page.waitForFunction(()=>document.querySelectorAll(".player-card").length>0);
 };
 const giveUp=async()=>{
  await page.locator("#give-up").click();
  await page.waitForFunction(()=>!document.querySelector("#result").classList.contains("hidden"));
 };
 await openTeam("easy",2018,"Argentina");
 assert.equal(await page.locator(".player-card").count(),23,"Argentina 2018 must show its full 23-player squad");
 assert.equal(await page.locator("#guess").isEnabled(),true,"player input must be enabled");
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
 assert.equal(await page.locator(".player-card.missed").count(),21,"Give Up must reveal every missing player");
 await page.locator("#result-home").click();
 await page.locator('[data-open-screen="stats"]').click();
 assert.equal((await page.locator("#local-played").textContent()).trim(),"1");
 assert.equal((await page.locator("#local-found").textContent()).trim(),"2");
 assert.equal((await page.locator("#local-best").textContent()).trim(),"9%");
 await page.locator("[data-back]").click();
 await openTeam("hard",2018,"Argentina");
 assert.equal((await page.locator(".player-hint").first().textContent()).trim(),"HIDDEN PLAYER","Hard mode must hide all starting hints");
 await page.locator("#guess").fill("Messi");await page.locator("#guess").press("Enter");
 await page.waitForFunction(()=>document.querySelector(".player-card.found .player-name")?.textContent==="Lionel Messi");
 assert.equal((await page.locator(".player-card.found .player-hint").textContent()).trim(),"FOUND");
 await giveUp();await page.locator("#result-home").click();
 await page.locator("[data-back]").click();
 await openTeam("practice",2018,"Argentina");
 assert.equal((await page.locator("#timer").textContent()).trim(),"∞","Practice must have no timer");
 await page.waitForTimeout(1200);
 assert.equal((await page.locator("#timer").textContent()).trim(),"∞");
 await giveUp();await page.locator("#result-home").click();
 await page.locator("[data-back]").click();
 const dailyStart=async tier=>{
  await page.locator('[data-mode="daily-'+tier+'"]').click();
  await page.waitForFunction(()=>document.querySelector("#game").classList.contains("active"));
  assert.equal(await page.locator(".player-card").count()>0,true,"Daily must load a complete squad");
 };
 await dailyStart("common");
 const dailyFirstTeam=(await page.locator("#game-team").textContent()).trim();
 assert.notEqual((await page.locator(".player-hint").first().textContent()).trim(),"HIDDEN PLAYER","Daily Common must show hints");
 for(let round=0;round<3;round++){
  await giveUp();
  if(round<2)await page.locator("#result-home").click();
 }
 await page.locator("#result-home").click();
 assert.match(await page.locator("#result-message").textContent(),/Three local squads played/);
 await page.locator("#result-home").click();
 await page.locator('[data-open-screen="stats"]').click();
 assert.equal((await page.locator("#local-played").textContent()).trim(),"4","a completed Daily challenge must count once in local stats");
 await page.locator("[data-back]").click();
 await dailyStart("common");
 assert.equal((await page.locator("#game-team").textContent()).trim(),dailyFirstTeam,"Daily squad selection must be stable throughout the local day");
 await page.locator("[data-back]").click();
 await page.locator("[data-back]").click();
 await dailyStart("niche");
 await giveUp();await page.locator("#result-home").click();await giveUp();await page.locator("#result-home").click();await giveUp();await page.locator("#result-home").click();await page.locator("#result-home").click();
 await page.locator("[data-back]").click();
 await dailyStart("legendary");
 assert.equal((await page.locator(".player-hint").first().textContent()).trim(),"HIDDEN PLAYER","Daily Legendary must hide all hints");
 await giveUp();await page.locator("#result-home").click();await giveUp();await page.locator("#result-home").click();await giveUp();await page.locator("#result-home").click();await page.locator("#result-home").click();
 await page.locator("[data-back]").click();
 await openTeam("easy",2026,"Germany");
 assert.equal(await page.locator(".player-card").count(),26,"2026 squads must show 26 registered players");
 assert.match(await page.locator(".player-hint").first().textContent(),/GK|DF|MF|FW/);
 await giveUp();
 await page.locator("#result-home").click();
 await page.locator('[data-open-screen="settings"]').click();
 await page.locator("#setting-compact").check();
 await page.locator("#setting-motion").check();
 await page.locator("#save-settings").click();
 assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("compact-ui")),true);
 assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("reduce-motion")),true);
 await page.locator("#clear-local-stats").count();
 assert.deepEqual(errors,[],"the app must not throw browser runtime errors");
 await context.close();

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
 assert.deepEqual(offlineErrors,[],"the cached app must run after a cold offline reload");
 await offlineContext.close();
 console.log("Browser smoke suite passed: mobile menu, all 240 teams, normal/hard/practice, all Daily tiers, Give Up, results, local stats, settings and offline reload.");
}finally{
 await browser.close();
 await new Promise(resolveClose=>server.close(resolveClose));
}
