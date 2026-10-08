/* Present · 游戏逻辑 v2.0 */
(function(){
"use strict";

var STORE = ZZ_STORE_KEY;
var DEFAULTS = ZZ_DEFAULTS;
var CAST = ZZ_CAST;
var LINES = ZZ_LINES;
var AMBIENT = ZZ_AMBIENT;
var AFTER_ANY = ZZ_AFTER_ANY;
var NIGHTS = ZZ_NIGHTS;
var EVENTS = ZZ_EVENTS;
var SKIP_LINES = ZZ_SKIP_LINES;
var AFTER_MONOLOGUES = ZZ_AFTER_MONOLOGUES;
var SKIP_LONGING = ZZ_SKIP_LONGING;

var BG_ACTS = {
  grandpa:[
    "他在院子里坐了一下午。",
    "他自己摆了一盘棋。摆完没收。",
    "他翻了一会儿抽屉，又合上了。",
    "他在沙发上睡着了。电视还开着。",
    "他给花浇了水。浇了很久。",
    "他一个人吃了饭。吃了很少。",
    "他把收音机打开了，听了一会儿，又关了。",
    "他在屋里走了一圈，又坐下了。",
    "他把茶杯里的水倒了，没再倒。",
    "他看着窗外，看了很久。"
  ],
  grandma:[
    "她在厨房站了很久。",
    "她翻了一会儿相册。",
    "她择了一把菜，择得很慢。",
    "她看了很久的电视。其实没在看。",
    "她把你的房间又擦了一遍。",
    "她包了一些饺子，冻在冰箱里。",
    "她把旧衣服拿出来晒了。晒了一天。",
    "她在屋里坐了一会儿，又去厨房了。",
    "她把桌上的东西擦了擦。擦了两次。",
    "她给花浇了水。浇完又浇了一遍。"
  ],
  dad:[
    "他在院子里抽了很久的烟。",
    "他修了一下水龙头。修了半天。",
    "他出去了一趟，很晚才回来。",
    "他坐在门口看了一会儿外面。",
    "他把工具箱打开又合上。",
    "他喝了点酒。一个人喝的。",
    "他把车洗了一遍。洗了很久。",
    "他在屋里转了一圈，又出去了。",
    "他坐在沙发上，闭了一会儿眼。",
    "他把手机拿出来看了一眼，又放回去了。"
  ],
  mom:[
    "她把家里收拾了一遍。",
    "她在厨房做了很多菜。",
    "她翻了一会儿旧照片。",
    "她给你房间的被子晒了。",
    "她缝了一件旧衣服。缝了很久。",
    "她打了几个电话。声音很小。",
    "她把冰箱里的东西整理了一遍。",
    "她在厨房里站了很久。不知道在做什么。",
    "她把桌子擦了。擦了又擦。",
    "她把窗户打开了，又关上了。"
  ],
  bro:[
    "他打了一下午游戏。",
    "他出去了一趟。没说去哪。",
    "他戴着耳机听了一整天。",
    "他刷了一天的手机。",
    "他在楼下站了很久。",
    "他睡了很久。中午才起来。",
    "他把房间门关了。一整天没出来。",
    "他出去买了点东西，很快就回来了。",
    "他在客厅坐了一会儿，又回屋了。",
    "他把桌子上的东西收了一遍。"
  ]
};

var $ = function(id){ return document.getElementById(id); };
var G = null, cfg = null, busy = false, pending = null;

function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

/* 近因去重：从池中随机取一个，但排除最近用过的 */
var _pickHistory = {};
function pickNoRepeat(pool, key, historySize){
  historySize = historySize || 3;
  var used = _pickHistory[key] || [];
  var available = [];
  for(var i=0;i<pool.length;i++){
    if(used.indexOf(pool[i]) === -1) available.push(i);
  }
  if(!available.length){
    // 池子用完了，重置历史
    _pickHistory[key] = [];
    used = [];
    available = [];
    for(var i=0;i<pool.length;i++) available.push(i);
  }
  var idx = available[Math.floor(Math.random()*available.length)];
  used.push(pool[idx]);
  if(used.length > historySize) used.shift();
  _pickHistory[key] = used;
  return pool[idx];
}

function evNow(){ return EVENTS[G.day % EVENTS.length]; }
function tripDays(){ return evNow().days; }
function isLastDay(){ return G.d >= tripDays(); }
function aliveList(){ return G.chars.filter(function(c){ return !c.gone; }); }
function lostCount(){ return G.chars.length - aliveList().length; }
function nameOf(id){
  for(var i=0;i<G.chars.length;i++) if(G.chars[i].id === id) return G.chars[i].name;
  return "";
}

function fresh(){
  return {
    day: 0, gap: 1, awayFor: 1, trips: 0, over: false, lastGone: null,
    d: 1, daySlot: cfg.perDay, sat: {}, offer: {}, tripSat: {},
    chars: CAST.map(function(c){
      return { id:c.id, name:c.name, ageW:c.ageW,
               gone:false, lineIdx:0, specialKey:null, specialSeen:0 };
    }),
    backgroundEvents: [],
    interactionLog: [],
    dayAfterShown: new Set()
  };
}
function save(){ try{ localStorage.setItem(STORE, JSON.stringify({g:G,cfg:cfg})); }catch(e){} }
function wipe(){ try{ localStorage.removeItem(STORE); }catch(e){} }
function load(){
  try{
    var raw = localStorage.getItem(STORE); if(!raw) return false;
    var d = JSON.parse(raw);
    if(!d || !d.g || !d.g.chars || !d.g.chars.length) return false;
    G = d.g; cfg = Object.assign({}, DEFAULTS, d.cfg || {});
    if(typeof G.gap !== "number") G.gap = 1;
    if(typeof G.awayFor !== "number") G.awayFor = 1;
    if(typeof G.trips !== "number") G.trips = 0;
    if(typeof G.over !== "boolean") G.over = false;
    if(typeof G.lastGone === "undefined") G.lastGone = null;
    if(typeof G.d !== "number") G.d = 1;
    if(typeof G.daySlot !== "number") G.daySlot = cfg.perDay;
    if(!G.offer || typeof G.offer !== "object") G.offer = {};
    if(!Array.isArray(G.backgroundEvents)) G.backgroundEvents = [];
    if(!Array.isArray(G.interactionLog)) G.interactionLog = [];
    G.dayAfterShown = new Set();
    G.chars.forEach(function(c){
      delete c.len; delete c.cost;
      if(typeof c.lineIdx !== "number") c.lineIdx = 0;
      if(typeof c.specialSeen !== "number") c.specialSeen = 0;
      if(typeof c.specialKey === "undefined") c.specialKey = null;
    });
    G.daySlot = Math.min(G.daySlot, cfg.perDay);
    if(!Object.keys(G.offer).length) drawOffers();
    return true;
  }catch(e){ return false; }
}
function show(id){
  var vs = document.querySelectorAll(".view");
  for(var i=0;i<vs.length;i++) vs[i].classList.remove("on");
  $(id).classList.add("on"); window.scrollTo(0,0);
}

function leaveChance(c){
  if(G.day < cfg.safe) return 0;
  var t = G.day - cfg.safe;
  return Math.min(0.85, cfg.leave * (1 + t * cfg.accel) * c.ageW);
}

/* ---------- 文本选择 ---------- */

function actPool(c){
  var all = LINES[c.id].acts;
  var pool = all.filter(function(a){
    return c.lineIdx >= a.lo && c.lineIdx <= a.hi && a.c <= cfg.perDay;
  });
  if(!pool.length) pool = all.filter(function(a){ return a.c <= cfg.perDay; });
  if(!pool.length) pool = all;
  return pool;
}
function drawOffers(){
  G.offer = {};
  G.chars.forEach(function(c){
    if(c.gone) return;
    G.offer[c.id] = pick(actPool(c));
  });
}
function cycleSpecial(c, key, pool){
  if(c.specialKey !== key){ c.specialKey = key; c.specialSeen = 0; }
  var t = pool[Math.min(c.specialSeen, pool.length - 1)];
  c.specialSeen++;
  return t;
}
function pickState(c){
  var bank = LINES[c.id];
  if(G.lastGone && bank.after && bank.after[G.lastGone] && !G.dayAfterShown.has(c.id)){
    G.dayAfterShown.add(c.id);
    return bank.after[G.lastGone][0];
  }
  if(G.lastGone && AFTER_ANY[c.id] && !G.dayAfterShown.has(c.id)){
    G.dayAfterShown.add(c.id);
    return AFTER_ANY[c.id][0];
  }
  return bank.main[Math.min(c.lineIdx, bank.main.length - 1)];
}
function pickFill(c){ return pickNoRepeat(LINES[c.id].fill, "fill_" + c.id, 5); }
function pickReunion(c){
  if(G.awayFor < 2) return null;
  var bank = LINES[c.id];
  if(G.lastGone && (bank.after[G.lastGone] || AFTER_ANY[c.id])) return null;
  return cycleSpecial(c, "away", bank.away);
}
function pickAmbient(){
  var alive = aliveList().length;
  if(isLastDay()) return pickNoRepeat(AMBIENT.leaving, "amb_leave", 4);
  if(G.lastGone){
    // 存活越少，lost 权重越高
    var lostChance = alive <= 2 ? 0.9 : (alive <= 3 ? 0.75 : 0.7);
    return (Math.random() < lostChance) ? pickNoRepeat(AMBIENT.lost, "amb_lost", 4) : null;
  }
  if(G.awayFor >= 2) return pickNoRepeat(AMBIENT.away, "amb_away", 3);
  if(G.day >= 5) return (Math.random() < 0.6) ? pickNoRepeat(AMBIENT.late, "amb_late", 4) : null;
  return (Math.random() < 0.5) ? pickNoRepeat(AMBIENT.normal, "amb_normal", 4) : null;
}

/* ---------- ① 假期前 ---------- */

function eventBody(ev){
  var bodies = ev.bodies || [ev.body];
  var idx = Math.min(G.day, bodies.length - 1);
  var out = bodies[idx];
  if(ev.extra && lostCount() > 0){
    var gone = lostCount();
    out += "\n" + (gone === 1 ? ev.extra : ev.extraMany.replace("{n}", gone));
  }
  return out;
}
function enterBefore(){
  G.interactionLog = [];
  var ev = evNow();
  $("before-title").textContent = ev.name;
  $("before-text").textContent = aliveList().length === 0
    ? "院子里没有人了。"
    : eventBody(ev);

  var sub = "";
  if(aliveList().length > 0){
    if(G.gap === 2)      sub = "上一个假期你没回来。";
    else if(G.gap >= 3)  sub = "你连着 " + (G.gap - 1) + " 个假期没回来了。";
  }
  $("before-sub").textContent = sub;
  renderDebug(); save();
  show("v-before");
}

function skipVisit(){
  G.gap++;
  var mainText = SKIP_LINES[Math.min(G.gap - 1, SKIP_LINES.length - 1)];
  var longing = "";
  if(G.gap >= 2 && Math.random() < 0.5){
    longing = "\n" + pickNoRepeat(SKIP_LONGING, "skip_long", 3);
  }
  $("skip-text").textContent = mainText + longing;
  show("v-skip");
}
function skipContinue(){
  advance();
  if(G.over) return showEnd();
  enterBefore();
}

/* ---------- ② Present ---------- */

function renderBar(){
  var ev = evNow();
  $("visit-title").innerHTML = isLastDay()
    ? ev.name + ' · <span class="lastday">最后一天</span>'
    : ev.name + ' · <span class="dayname">第 ' + G.d + ' 天</span>';
  var b = $("btn-leave");
  if(pending){ b.textContent = "……"; b.className = "ghost"; }
  else if(isLastDay()){ b.textContent = "该走了"; b.className = "warn"; }
  else { b.textContent = "今天先这样"; b.className = "ghost"; }
  $("btn-hint").style.display = pending ? "none" : "";
}
function renderSlots(){
  var el = $("slots"); el.innerHTML = "";
  for(var i=0;i<cfg.perDay;i++){
    var d = document.createElement("div");
    d.className = "sl" + (i < G.daySlot ? "" : " used");
    el.appendChild(d);
  }
}
function renderPeople(){
  var box = $("people"); box.innerHTML = "";
  G.chars.forEach(function(c){
    var d = document.createElement("div");
    var off = G.offer[c.id];
    var cls = "p";
    if(c.gone) cls += " gone";
    else{
      if(G.sat[c.id]) cls += " done";
      if(!off || off.c > G.daySlot) cls += " noway";
      if(pending) cls += " locked";
    }
    d.className = cls;
    var dots = "";
    if(!c.gone && off){
      for(var k=0;k<off.c;k++) dots += "<i></i>";
    }
    d.innerHTML = '<div class="fig"><div class="hd"></div><div class="bd"></div></div>' +
                  '<div class="nm">' + c.name + '</div>' +
                  '<div class="of">' + (c.gone ? "&nbsp;" : (off ? off.s : "")) + '</div>' +
                  '<div class="cost">' + dots + '</div>';
    if(!c.gone && !pending) d.onclick = function(){ interact(c.id); };
    box.appendChild(d);
  });
}
function log(html, cls){
  var el = $("visit-log"), p = document.createElement("p");
  if(cls) p.className = cls;
  p.innerHTML = html; el.appendChild(p); el.scrollTop = el.scrollHeight;
}
function logBeat(name, lines, dedupeKey){
  var el = $("visit-log");
  if(dedupeKey){
    if(el.getAttribute("data-last") === dedupeKey) return;
    el.setAttribute("data-last", dedupeKey);
  }
  var div = document.createElement("div");
  div.className = "beat";
  var html = name ? '<div class="who">' + name + "</div>" : "";
  for(var i=0;i<lines.length;i++){
    html += '<p style="animation-delay:' + (i * 0.13).toFixed(2) + 's">' + lines[i] + "</p>";
  }
  div.innerHTML = html;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function startDay(){
  drawOffers();
  G.dayAfterShown = new Set();
  $("visit-log").innerHTML =
    '<p class="day">' + (isLastDay() ? "最后一天。" : "第 " + G.d + " 天。") + "</p>";
  renderBar(); renderSlots(); renderPeople(); renderDebug();
}

function interact(id){
  if(busy || pending) return;
  var c = null;
  for(var i=0;i<G.chars.length;i++) if(G.chars[i].id === id) c = G.chars[i];
  if(!c || c.gone) return;
  var off = G.offer[id];
  if(!off) return;

  if(off.c > G.daySlot){
    logBeat(c.name, ['<span class="q">天快黑了。这一趟没去成。</span>'], "miss-" + G.d + "-" + id);
    return;
  }
  G.daySlot -= off.c;
  var first = !G.sat[id];
  G.sat[id] = (G.sat[id] || 0) + 1;
  G.offer[id] = pick(actPool(c));

  var lines = [off.t];
  G.interactionLog.push({ charId: c.id, charName: c.name, text: off.t, day: G.d });
  var amb = pickAmbient(); if(amb) lines.push('<span class="q">' + amb + "</span>");
  var reu = pickReunion(c); if(reu) lines.push('<span class="q">' + reu + "</span>");
  lines.push(first ? pickState(c) : pickFill(c));
  logBeat(c.name, lines, c.id + "-" + G.d + "-" + G.sat[id]);

  renderBar(); renderSlots(); renderPeople(); renderDebug(); save();
  if(G.daySlot <= 0) setTimeout(function(){ if(G.daySlot <= 0 && !pending) endDay(); }, 1100);
}

function endDay(){
  if(busy || pending) return;
  if(isLastDay()){
    log("明天早上的车。", "night");
    pending = "dusk";
  }else{
    var remain = tripDays() - G.d;
    var pool = remain >= 3 ? NIGHTS.early : (remain === 2 ? NIGHTS.mid : NIGHTS.last);
    var nightKey = "night_" + (remain >= 3 ? "early" : (remain === 2 ? "mid" : "last"));
    log(pickNoRepeat(pool, nightKey, 5), "night");
    pending = "day";
  }
  renderBar(); renderPeople(); save();
}

function advancePending(){
  if(!pending) return;
  var p = pending; pending = null;
  if(p === "dusk") return goDusk();
  G.d++; G.daySlot = cfg.perDay; G.sat = {};
  startDay(); save();
}

/* ---------- ③ 散场 ---------- */

function goDusk(){
  busy = true;
  var box = $("dusk-people"); box.innerHTML = "";
  G.chars.forEach(function(c){
    var d = document.createElement("div");
    d.className = "p" + (c.gone ? " gone" : "");
    d.innerHTML = '<div class="fig"><div class="hd"></div><div class="bd"></div></div>' +
                  '<div class="nm">' + c.name + '</div>';
    box.appendChild(d);
  });
  show("v-dusk");
  var duskLog = $("dusk-log");
  duskLog.innerHTML = '<p class="q">该走了。</p>';
  var kids = box.querySelectorAll(".p:not(.gone)"), i = 0;
  var timer = setInterval(function(){
    if(i >= kids.length){
      clearInterval(timer);
      setTimeout(function(){
        var p1 = document.createElement("p");
        p1.className = "q";
        p1.style.animation = "rise .7s ease both";
        p1.textContent = "院子里没有人了。";
        duskLog.appendChild(p1);
      }, 600);
      setTimeout(function(){
        var p2 = document.createElement("p");
        p2.className = "q";
        p2.style.animation = "rise .7s ease both";
        p2.textContent = "风把门带上了。";
        duskLog.appendChild(p2);
      }, 1400);
      setTimeout(function(){
        var p3 = document.createElement("p");
        p3.className = "q";
        p3.style.animation = "rise .7s ease both";
        p3.textContent = "你站了一会儿。不知道该跟谁说再见。";
        duskLog.appendChild(p3);
      }, 2200);
      setTimeout(function(){ $("btn-dusk").style.display = ""; busy = false; goAfter(); }, 2800);
      return;
    }
    kids[i].style.opacity = "0"; i++;
  }, 430);
}

function getAfterMonologue(){
  var trips = G.trips;
  var pool;
  if(trips <= 1) pool = AFTER_MONOLOGUES.first;
  else if(trips <= 3) pool = AFTER_MONOLOGUES.mid;
  else pool = AFTER_MONOLOGUES.late;
  var lines = [];
  var alive = aliveList().length;
  if(alive === 0){
    lines.push("院子空了。你也不知道下一次回去是为了什么。");
  } else if(G.lastGone){
    lines.push(nameOf(G.lastGone) + "的位置空了。");
  }
  for(var i=0;i<pool.length;i++) lines.push(pool[i]);
  return lines;
}

function goAfter(){
  var lines = getAfterMonologue();
  var html = "";
  for(var i=0;i<lines.length;i++){
    html += '<p style="animation-delay:' + (i * 0.18).toFixed(2) + 's">' + lines[i] + "</p>";
  }
  $("after-body").innerHTML = html;
  show("v-after");
}

function goReview(){
  var rows = "";
  var missed = [];
  G.chars.forEach(function(c){
    if(c.gone){
      rows += '<div class="row"><span class="who">' + c.name +
              '</span><span class="did miss">已经不在</span></div>';
      return;
    }
    var s = G.tripSat[c.id] || 0;
    var tail = s > 0 ? s + " 次"
                     : '<span class="miss">这一次你没跟他说上话</span>';
    rows += '<div class="row"><span class="who">' + c.name +
            '</span><span class="did">' + tail + "</span></div>";
    if(s === 0) missed.push(c.name);
  });

  var title = "这一次，你在场的日子";
  var fr = "";
  if(G.awayFor >= 2){
    title = "隔了 " + (G.awayFor - 1) + " 个假期，你回来了";
    fr = '<div class="fn">你没回来的那些假期里，发生过什么，你不知道。</div>';
  }
  $("review-title").textContent = title;
  var bodyHtml = rows;
  if(missed.length > 0){
    bodyHtml += '<div class="fn">' + missed.join("、") + "——这一次，你没跟他们坐一会儿。</div>";
  }
  bodyHtml += '<div class="fn">没有评分。这一页只是让你看一眼：这几天，你人在哪儿。</div>' + fr;
  if(G.backgroundEvents.length > 0){
    bodyHtml += '<div class="act center" style="border:none;padding-top:10px">' +
      '<button id="btn-look-back" class="ghost">看看你不在的时候</button></div>';
  }
  $("review-body").innerHTML = bodyHtml;
  show("v-review");

  var lb = $("btn-look-back");
  if(lb) lb.onclick = function(){ enterReviewBack(); };
}

/* ---------- 回看：你不在的时候 ---------- */

function generateBackgroundEvents(){
  var events = [];
  var interactedIds = {};
  G.interactionLog.forEach(function(e){ interactedIds[e.charId] = true; });
  G.chars.forEach(function(c){
    if(c.gone || interactedIds[c.charId || c.id]) return;
    var pool = BG_ACTS[c.id];
    if(pool){
      events.push({ name: c.name, text: pickNoRepeat(pool, "bg_" + c.id, 4) });
    }
  });
  return events;
}

function enterReviewBack(){
  var body = $("review-back-body");
  var html = "";
  G.backgroundEvents.forEach(function(ev){
    html += '<div class="row"><span class="who">' + ev.name +
            '</span><span class="did">' + ev.text + '</span></div>';
  });
  html += '<div class="fn">这些事发生的时候，你不在。</div>';
  body.innerHTML = html;
  show("v-review-back");
}

/* ---------- ⑤ 名单 ---------- */

function advance(){
  var before = aliveList().length;
  G.day++;

  G.chars.forEach(function(c){
    if(c.gone) return;
    c.lineIdx++;
    if(before > 2 && Math.random() < leaveChance(c)){
      c.gone = true;
      G.lastGone = c.id;
    }
  });

  if(G.day >= cfg.total || aliveList().length === 0) G.over = true;

  G.backgroundEvents = generateBackgroundEvents();
  G.tripSat = Object.assign({}, G.sat);
  G.d = 1; G.daySlot = cfg.perDay; G.sat = {}; G.offer = {};
  G.dayAfterShown = new Set(); pending = null;
}

function enterRoster(){
  advance();
  if(G.over) return showEnd();

  $("roster-title").textContent = "下一次，是" + evNow().name;

  var box = $("roster"); box.innerHTML = "";
  G.chars.forEach(function(c){
    var d = document.createElement("div");
    d.className = "seat" + (c.gone ? " empty" : "");
    d.innerHTML = '<div class="st"></div><div class="sn">' + c.name + '</div><div class="bowl"></div>';
    box.appendChild(d);
  });

  var left = aliveList(), note, quiet = false;
  if(left.length === G.chars.length){
    note = "这一次，人都还在。";
  }else{
    note = G.chars.filter(function(c){ return c.gone; })
                   .map(function(c){ return c.name; }).join("、") + "不在。";
    quiet = true;
  }
  var el = $("roster-note");
  el.textContent = note;
  el.className = "q" + (quiet ? " quiet" : "");

  save(); renderDebug(); show("v-roster");
}

function showEnd(){
  var left = aliveList();
  var endLine;
  if(G.trips === 0){
    endLine = "你一次也没有回去过。";
  } else if(G.lastGone){
    endLine = "你买了票。但这是最后一张了。";
  } else if(G.gap >= 2){
    endLine = "你没有买票。";
  } else {
    endLine = "你买了票。";
  }
  $("end-line").textContent = endLine;
  $("end-stat").textContent =
    "这些年，你回去过 " + G.trips + " 次。\n" +
    (left.length === 0 ? "那张桌子，已经不在了。"
                       : "桌上还坐着 " + left.length + " 个人。");
  save(); show("v-end");
}

/* ---------- 调试 ---------- */

function renderDebug(){
  if(!G) return;
  $("cfg-perday").value = cfg.perDay;
  $("cfg-total").value  = cfg.total;
  $("cfg-safe").value   = cfg.safe;
  $("cfg-leave").value  = cfg.leave;
  $("cfg-accel").value  = cfg.accel;

  var ev = evNow();
  var html = "<tr><th>角色</th><th class='num'>主线</th><th>今天想做的</th>" +
             "<th class='num'>耗时</th><th class='num'>离开概率</th><th>状态</th></tr>";
  G.chars.forEach(function(c){
    var p = c.gone ? 0 : leaveChance(c);
    var off = G.offer[c.id];
    html += "<tr><td>" + c.name + "</td><td class='num'>" + c.lineIdx + " / " +
            LINES[c.id].main.length + "</td><td>" +
            (c.gone ? "—" : (off ? off.s : "—")) +
            "</td><td class='num'>" +
            (c.gone || !off ? "—" : off.c) +
            "</td><td class='num " + (p > 0 ? "risk-yes" : "") + "'>" +
            (c.gone ? "—" : (Math.round(p*1000)/10) + "%") +
            "</td><td>" + (c.gone ? "已不在" : "在") + "</td></tr>";
  });
  var safe = G.day < cfg.safe;
  html += "<tr><th>进度</th><th class='num'>第 " + (G.day + 1) + " / " + cfg.total + " 局</th>" +
          "<th>" + ev.name + " " + G.d + " / " + tripDays() + " 天</th>" +
          "<th class='num'>今天剩 " + G.daySlot + "</th><th class='num'>回家 " + G.trips + " 次</th><th>" +
          (safe ? "安全期内" : "不在安全期") +
          " · 最近离开：" + (G.lastGone ? nameOf(G.lastGone) : "无") + "</th></tr>";
  $("dbg-table").innerHTML = html;
}

/* ---------- 启动 ---------- */

function newGame(){
  cfg = Object.assign({}, DEFAULTS, cfg || {});
  G = fresh();
  save(); renderDebug(); show("v-title");
}

function boot(){
  cfg = Object.assign({}, DEFAULTS);

  $("btn-start").onclick = function(){ enterBefore(); };
  $("btn-go").onclick = function(){
    busy = false; pending = null;
    G.awayFor = G.gap; G.gap = 1; G.trips++;
    G.d = 1; G.daySlot = cfg.perDay; G.sat = {};
    startDay(); save();
    show("v-visit");
  };
  $("btn-skip").onclick = skipVisit;
  $("btn-skip-next").onclick = skipContinue;
  $("btn-leave").onclick = function(){ pending ? advancePending() : endDay(); };
  $("btn-dusk").onclick  = function(){};
  $("btn-hint").onclick  = function(){
    log('<span class="q">点一个人，就是陪他。陪谁，就等于不陪谁。</span>');
  };
  $("btn-after").onclick = goReview;
  $("btn-next").onclick  = function(){
    if(G.backgroundEvents.length > 0){
      enterReviewBack();
    } else {
      enterRoster();
    }
  };
  $("btn-back-next").onclick = function(){ enterRoster(); };
  $("btn-again").onclick = function(){ busy = false; pending = null; enterBefore(); };
  $("btn-restart").onclick = function(){ wipe(); cfg = Object.assign({}, DEFAULTS); newGame(); };

  $("cfg-perday").onchange = function(){
    var v = parseInt(this.value,10); if(isNaN(v)) return;
    cfg.perDay = Math.max(1, Math.min(8, v));
    if(G) G.daySlot = Math.min(G.daySlot, cfg.perDay);
    renderSlots(); renderDebug(); save();
  };
  $("cfg-total").onchange = function(){
    var v = parseInt(this.value,10); if(isNaN(v)) return;
    cfg.total = Math.max(4, Math.min(40, v)); renderDebug(); save();
  };
  $("cfg-safe").onchange = function(){
    var v = parseInt(this.value,10); if(isNaN(v)) return;
    cfg.safe = Math.max(0, Math.min(10, v)); renderDebug(); save();
  };
  $("cfg-leave").onchange = function(){
    var v = parseFloat(this.value); if(isNaN(v)) return;
    cfg.leave = Math.max(0, Math.min(1, v)); renderDebug(); save();
  };
  $("cfg-accel").onchange = function(){
    var v = parseFloat(this.value); if(isNaN(v)) return;
    cfg.accel = Math.max(0, Math.min(1, v)); renderDebug(); save();
  };
  $("btn-reset").onclick = function(){ wipe(); cfg = Object.assign({}, DEFAULTS); newGame(); };

  var introShown = false;
  try{ introShown = localStorage.getItem(STORE + "_intro") === "1"; }catch(e){}

  if(!load()){
    if(!introShown){
      show("v-intro");
      $("btn-intro-start").onclick = function(){
        try{ localStorage.setItem(STORE + "_intro", "1"); }catch(e){}
        newGame();
        enterBefore();
      };
      return;
    }
    newGame();
  }
  else if(G.over) showEnd();
  else { renderDebug(); enterBefore(); }
}

boot();

})();
