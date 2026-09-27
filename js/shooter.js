/* ============ 单词射击模式：打飞机小游戏背词 ============ */
(function () {
  'use strict';

  var canvas, ctx, raf = null;
  var G = null; // 当前局状态，退出时置 null 防泄漏

  var TOTAL = 10;      // 每局题数
  var MAX_HP = 3;      // 生命数

  function $(id) { return document.getElementById(id); }

  function start(words, bankId) {
    canvas = $('sh-canvas');
    ctx = canvas.getContext('2d');

    var queue = words.slice(0, TOTAL);
    G = {
      W: 0, H: 0,
      queue: queue, qi: 0,
      score: 0, combo: 0, maxCombo: 0, hp: MAX_HP,
      correctCount: 0, wrongWords: [],
      planes: [], bullets: [], particles: [], clouds: [],
      cannonX: 0.5, // 比例坐标，随宽度缩放
      firing: false, targetX: null, targetY: null,
      spawnTimer: 0, settled: false, lockUntil: 0,
      bankId: bankId
    };

    // 背景云朵
    for (var i = 0; i < 5; i++) {
      G.clouds.push({ x: Math.random(), y: 0.06 + Math.random() * 0.3, r: 18 + Math.random() * 26, v: 0.00012 + Math.random() * 0.0002 });
    }

    $('sh-score').textContent = '0';
    $('sh-combo').textContent = '×0';
    renderHp();
    resize(); // 必须在 G 创建之后，写入 W/H
    bindInput();
    nextPrompt(true);
    loop();
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G && (G.W = rect.width, G.H = rect.height);
  }

  /* ---------- 出题：一个正确单词 + 干扰项组成飞机 ---------- */
  function nextPrompt(first) {
    if (G.qi >= G.queue.length) { return end(true); }
    var cur = G.queue[G.qi];
    G.answer = cur;
    G.settled = false;

    var promptEl = $('sh-prompt');
    promptEl.innerHTML = '';
    promptEl.append(document.createTextNode('🎯 ' + cur.m));
    if (cur.ph) {
      var ph = document.createElement('span');
      ph.className = 'phonetic';
      ph.textContent = cur.ph;
      promptEl.append(ph);
    }

    // 干扰项：从词库随机找释义不同的词
    var wrongs = pickDistractors(cur, 2);
    var opts = Store.shuffle([cur].concat(wrongs));
    G.planes = opts.map(function (w, i) {
      return {
        word: w,
        x: (0.18 + 0.32 * i + Math.random() * 0.12),
        y: -0.12 - Math.random() * 0.25,
        v: 0.00016 + Math.random() * 0.00008 + Math.min(0.0001, G.qi * 0.00001), // 逐题微微加速
        sway: Math.random() * Math.PI * 2,
        dead: false
      };
    });
    G.bullets = [];
    window.VHStore.speak(cur.w); // 出题即读单词，加强音形义联结
  }

  function pickDistractors(cur, n) {
    var bank = window.VHStore.getBank(G.bankId);
    var pool = bank.words.filter(function (w) { return w.w !== cur.w && w.m !== cur.m; });
    pool = Store.shuffle(pool);
    return pool.slice(0, n);
  }

  /* ---------- 输入 ---------- */
  var inputBound = false;
  function bindInput() {
    if (inputBound) return;
    inputBound = true;
    canvas.addEventListener('pointermove', function (e) {
      if (!G) return;
      var r = canvas.getBoundingClientRect();
      G.cannonX = (e.clientX - r.left) / r.width;
    });
    canvas.addEventListener('pointerdown', function (e) {
      if (!G) return;
      var r = canvas.getBoundingClientRect();
      G.cannonX = (e.clientX - r.left) / r.width;
      fire();
    });
    window.addEventListener('resize', function () { if (G) resize(); });
  }

  function fire() {
    if (Date.now() < G.lockUntil) return;
    Store.bump('shots');
    G.bullets.push({ x: G.cannonX, y: 0.92, v: 0.012 });
    Store.sfx.shoot();
  }

  /* ---------- 主循环 ---------- */
  function loop() {
    if (!G) return;
    var W = G.W, H = G.H, now = Date.now();
    ctx.clearRect(0, 0, W, H);

    // 云
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    G.clouds.forEach(function (c) {
      c.x += c.v * 16; if (c.x > 1.15) c.x = -0.15;
      drawCloud(c.x * W, c.y * H, c.r);
    });

    // 飞机
    G.planes.forEach(function (p) {
      if (p.dead) return;
      p.y += p.v * 16;
      p.sway += 0.03;
      var px = p.x * W + Math.sin(p.sway) * 14;
      var py = p.y * H;
      p.px = px; p.py = py;
      drawPlane(px, py, p.word.w);
      // 飞到底部未处理：不惩罚（温和模式），下一题自动替换
      if (py > H + 30 && !G.settled) {
        p.dead = true;
        var alive = G.planes.filter(function (q) { return !q.dead; });
        if (alive.length === 0) {
          // 全部错过：视为答错一次，软处理——扣 1 血并复盘
          onResult(false, true);
        }
      }
    });

    // 子弹（扫掠碰撞：用上一帧到当前帧的区间判定，防高速穿透）
    for (var i = G.bullets.length - 1; i >= 0; i--) {
      var b = G.bullets[i];
      var prevBy = b.y * H;
      b.y -= b.v * 16;
      var bx = b.x * W, by = b.y * H;
      ctx.fillStyle = '#ff8a5c';
      ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, Math.PI * 2); ctx.fill();
      if (by < -10) { G.bullets.splice(i, 1); continue; }
      // 命中检测：飞机中心纵向窗口落在子弹扫掠区间内
      for (var j = 0; j < G.planes.length; j++) {
        var pl = G.planes[j];
        if (pl.dead || pl.px === undefined) continue;
        var tw = measureWord(pl.word.w);
        var lo = pl.py - 16, hi = pl.py + 16;
        if (Math.abs(bx - pl.px) < tw / 2 + 16 && prevYOverlap(prevBy, by, lo, hi)) {
          G.bullets.splice(i, 1);
          hit(pl, now);
          break;
        }
      }
    }

    // 炮台
    drawCannon(G.cannonX * W, H - 14);

    // 粒子
    for (var k = G.particles.length - 1; k >= 0; k--) {
      var pt = G.particles[k];
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.06; pt.life -= 0.03;
      if (pt.life <= 0) { G.particles.splice(k, 1); continue; }
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.s, pt.s);
      ctx.globalAlpha = 1;
    }

    raf = requestAnimationFrame(loop);
  }

  // 子弹扫掠区间 [by, prevBy]（向上飞，by < prevBy）与目标区间 [lo, hi] 是否有交集
  function prevYOverlap(prevBy, by, lo, hi) {
    return by <= hi && prevBy >= lo;
  }

  function hit(pl, now) {
    pl.dead = true;
    explode(pl.px, pl.py, pl.word.w === G.answer.w);
    if (now < G.lockUntil || G.settled) return; // 本局已结算，只留特效不重复计分
    if (pl.word.w === G.answer.w) {
      G.combo++;
      G.maxCombo = Math.max(G.maxCombo, G.combo);
      var gain = 10 + Math.min(20, (G.combo - 1) * 2);
      G.score += gain;
      G.correctCount++;
      $('sh-score').textContent = G.score;
      $('sh-combo').textContent = '×' + G.combo;
      Store.sfx.good();
      pop(pl.word.w + ' ✓  +' + gain, true);
      onResult(true, false);
    } else {
      G.combo = 0;
      $('sh-combo').textContent = '×0';
      G.hp--;
      renderHp();
      Store.sfx.bad();
      pop('正确答案：' + G.answer.w, false);
      onResult(false, false);
    }
  }

  /* ---------- 回合结算（温和处理，无紧迫感） ---------- */
  function onResult(right, missedAll) {
    if (G.settled) return;
    G.settled = true;
    G.lockUntil = Date.now() + 1400;
    Store.markLearned(G.answer.w, right);
    if (!right) {
      Store.addMistake(G.answer);
      G.wrongWords.push(G.answer);
    }
    setTimeout(function () {
      if (!G) return;
      if (G.hp <= 0) return end(false);
      G.qi++;
      nextPrompt();
    }, 1300);
  }

  function renderHp() {
    var s = '';
    for (var i = 0; i < MAX_HP; i++) s += i < G.hp ? '❤️' : '🤍';
    $('sh-hp').textContent = s;
  }

  function pop(text, good) {
    var el = document.createElement('div');
    el.className = 'sh-pop ' + (good ? 'good' : 'bad');
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 950);
  }

  /* ---------- 绘制 ---------- */
  function measureWord(w) {
    ctx.font = '700 15px "PingFang SC", "Microsoft YaHei", sans-serif';
    return ctx.measureText(w).width;
  }

  function drawPlane(x, y, word) {
    var tw = measureWord(word);
    var bw = tw + 34;
    ctx.save();
    ctx.translate(x, y);
    // 机身胶囊
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.strokeStyle = '#a06bff';
    ctx.lineWidth = 2;
    roundRect(-bw / 2, -15, bw, 30, 15);
    ctx.fill(); ctx.stroke();
    // 机翼
    ctx.fillStyle = '#cdbcff';
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + 6, 13); ctx.lineTo(-bw / 2 - 6, 24); ctx.lineTo(-bw / 2 + 22, 15);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bw / 2 - 6, 13); ctx.lineTo(bw / 2 + 6, 24); ctx.lineTo(bw / 2 - 22, 15);
    ctx.closePath(); ctx.fill();
    // 单词
    ctx.fillStyle = '#5a4f70';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(word, 0, 1);
    ctx.restore();
  }

  function drawCannon(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#7a5cff';
    ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#5a4f70';
    ctx.fillRect(-4, -26, 8, 16);
    ctx.fillStyle = '#ff8a5c';
    ctx.beginPath(); ctx.arc(0, -4, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCloud(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.9, y + r * 0.2, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x - r * 0.9, y + r * 0.25, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function explode(x, y, good) {
    var colors = good ? ['#ffd86b', '#ff8a5c', '#5dd47e'] : ['#ffb0a0', '#ff6b6b', '#d0d0e0'];
    for (var i = 0; i < 16; i++) {
      var a = Math.PI * 2 * i / 16 + Math.random() * 0.4;
      G.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * (1.5 + Math.random() * 2.5),
        vy: Math.sin(a) * (1.5 + Math.random() * 2.5) - 1,
        s: 2 + Math.random() * 3,
        life: 1, color: colors[i % colors.length]
      });
    }
    Store.sfx.pop();
  }

  /* ---------- 结束 ---------- */
  function end(finished) {
    var stat = {
      score: G.score,
      correct: G.correctCount,
      total: finished ? G.queue.length : G.qi,
      maxCombo: G.maxCombo,
      wrongWords: G.wrongWords.slice()
    };
    var bestScore = Store.best('best_shooter', G.score);
    Store.bump('games');
    cleanup();
    window.VHApp.onGameEnd({ mode: 'shooter', maxCombo: stat.maxCombo });
    window.VHApp.showResult({
      mode: 'shooter',
      emoji: stat.score >= 100 ? '🎯' : '😊',
      title: stat.score >= 100 ? '神枪手！' : '玩得很开心！',
      sub: finished ? '本局完成 ' + stat.correct + '/' + stat.total + ' 题' : '中途休息 Also OK～',
      stats: [
        { n: stat.score, l: '得分' },
        { n: '×' + stat.maxCombo, l: '最高连击' },
        { n: bestScore, l: '历史最高' }
      ],
      wrongWords: stat.wrongWords
    });
  }

  function cleanup() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    G = null; // 释放引用，防内存泄漏
  }

  function running() { return !!G; }

  var Store = null;
  window.VHShooter = {
    boot: function (store) { Store = store; },
    start: start,
    stop: function () { if (running()) cleanup(); },
    running: running
  };
})();
