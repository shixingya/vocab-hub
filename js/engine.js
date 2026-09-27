/* ============ vocab-hub 通用游戏引擎：会话控制 + 选择题引擎 + 工具 ============ */
(function () {
  'use strict';

  var Store = null;
  var active = null;   // 当前局：{ cleanups:[], stop:fn }
  var MODES = [];      // 玩法注册表

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* ---------- 干扰项 / 近似拼写 ---------- */
  function distractors(bankId, cur, n) {
    var bank = Store.getBank(bankId);
    var pool = bank.words.filter(function (w) { return w.w !== cur.w && w.m !== cur.m; });
    return Store.shuffle(pool).slice(0, n);
  }
  function mutate(w) {
    var a = w.split('');
    if (a.length < 3) return null;
    var op = Math.random(), i;
    if (op < 0.4) { i = Math.floor(Math.random() * (a.length - 1)); var t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; }
    else if (op < 0.72) { i = Math.floor(Math.random() * a.length); a[i] = String.fromCharCode(97 + Math.floor(Math.random() * 26)); }
    else { i = Math.floor(Math.random() * a.length); a.splice(i, 1); }
    return a.join('');
  }
  function nearSpellings(word, n) {
    var out = [], tries = 0, low = word.toLowerCase();
    while (out.length < n && tries < n * 30) {
      tries++;
      var s = mutate(word);
      if (s && s !== word && s.toLowerCase() !== low && out.map(function (x) { return x.toLowerCase(); }).indexOf(s.toLowerCase()) < 0) out.push(s);
    }
    return out;
  }

  /* ---------- 启动一局 ---------- */
  function launch(mode, opts) {
    var bankId = opts.bankId, level = opts.level;
    var words = Store.pickWords(bankId, level, mode.count || 10);
    var need = mode.need || 4;
    if (words.length < need) {
      alert('这个词库可用单词不足 ' + need + ' 个，请先在上方切换词库或把难度设为「全部」。');
      return false;
    }
    var cleanups = [], finished = false;
    var s = { score: 0, combo: 0, max: 0, right: 0, total: words.length, wrong: [], i: 0 };

    function setHud() {
      var h = $('g-hud');
      if (h) h.innerHTML = mode.hud ? mode.hud(s) : ('得分 <b>' + s.score + '</b>　连击 <b>×' + s.combo + '</b>');
    }
    function prog() { var p = $('g-progress'); if (p) p.textContent = Math.min(s.i + 1, s.total) + '/' + s.total; }

    function award(right, w) {
      if (right) { s.combo++; if (s.combo > s.max) s.max = s.combo; s.right++; s.score += 10 + Math.min(20, (s.combo - 1) * 2); }
      else { s.combo = 0; if (w && s.wrong.indexOf(w) < 0) s.wrong.push(w); if (w) Store.addMistake(w); }
      if (w) Store.markLearned(w.w, right);
      setHud();
      return s;
    }

    function finish(o) {
      o = o || {};
      if (finished) return; finished = true;
      var right = o.right != null ? o.right : s.right;
      var total = o.total != null ? o.total : s.total;
      var max = o.max != null ? o.max : s.max;
      var wrong = o.wrong || s.wrong;
      var score = o.score != null ? o.score : s.score;
      if (max) Store.best('max_combo', max);
      Store.bump('games');
      var acc = total ? Math.round(right / total * 100) : 0;
      window.VHApp.onGameEnd({ mode: mode.id, maxCombo: max, allRight: wrong.length === 0 });
      window.VHApp.showResult({
        mode: mode.id,
        emoji: acc >= 80 ? '🎉' : acc >= 50 ? '😊' : '💪',
        title: acc >= 80 ? '太强了！' : acc >= 50 ? '表现不错！' : '继续加油！',
        sub: (o.sub || (mode.name + ' · 答对 ' + right + '/' + total)),
        stats: o.stats || [
          { n: score, l: '得分' }, { n: '×' + max, l: '最高连击' }, { n: acc + '%', l: '正确率' }
        ],
        wrongWords: wrong
      });
      teardown();
    }

    function teardown() {
      cleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
      if (!finished) { finished = true; }
    }

    var ctx = {
      mode: mode, words: words, bankId: bankId, s: s, Store: Store,
      body: $('game-body'),
      el: el, setHud: setHud, prog: prog, award: award, finish: finish,
      speak: Store.speak, sfx: Store.sfx, shuffle: Store.shuffle,
      distr: function (cur, n) { return distractors(bankId, cur, n); },
      near: nearSpellings,
      onCleanup: function (fn) { cleanups.push(fn); },
      isOver: function () { return finished; }
    };

    window.VHApp.showGame(mode);   // 切到通用游戏页并清空 body
    active = { stop: function () { teardown(); } };
    setHud(); prog();
    try { mode.run(ctx); } catch (e) { console.error('玩法启动失败', mode.id, e); }
    return true;
  }

  function exit() { if (active) { active.stop(); active = null; } }
  function running() { return !!active; }

  /* ---------- 通用「选择题」引擎 ----------
     cfg: prompt(cur)->html, options(cur)->[{t,ok}], speakFirst(cur),
          timed(ms), layout('grid2'|''), after(cur,right)->void  */
  function runQuiz(ctx, cfg) {
    var body = ctx.body, words = ctx.words, idx = 0, locked = false;
    ctx.setHud();
    function render() {
      if (ctx.isOver()) return;
      if (idx >= words.length) return ctx.finish();
      locked = false;
      var cur = words[idx]; ctx.s.i = idx; ctx.prog();
      body.innerHTML = '';
      var card = ctx.el('div', 'q-card');
      var q = ctx.el('div', 'q-prompt'); q.innerHTML = cfg.prompt(cur, ctx); card.appendChild(q);
      if (cfg.speakFirst) ctx.speak(cur.w);

      var opts = cfg.options(cur, ctx);
      var grid = ctx.el('div', 'q-opts ' + (cfg.layout || ''));
      opts.forEach(function (o) {
        var b = ctx.el('button', 'q-opt'); b.innerHTML = o.t; b.dataset.ok = o.ok ? '1' : '0';
        b.onclick = function () { if (locked) return; pick(o, b, cur, opts); };
        grid.appendChild(b);
      });
      card.appendChild(grid);
      if (cfg.decorate) cfg.decorate(card, cur, ctx);
      body.appendChild(card);

      if (cfg.timed) startTimer(cur, opts);
      idx++;
    }
    var timerFill = null, timerId = null;
    function startTimer(cur, opts) {
      var bar = ctx.el('div', 'q-timer'), fill = ctx.el('div', 'q-timer-fill');
      bar.appendChild(fill); ctx.body.querySelector('.q-card').appendChild(bar);
      timerFill = fill;
      requestAnimationFrame(function () { fill.style.transition = 'width ' + cfg.timed + 'ms linear'; fill.style.width = '0%'; });
      timerId = setTimeout(function () { if (!locked) timeUp(cur, opts); }, cfg.timed);
      ctx.onCleanup(function () { clearTimeout(timerId); });
    }
    function stopTimer() { if (timerFill) { timerFill.style.transition = 'none'; } if (timerId) { clearTimeout(timerId); timerId = null; } }
    function revealCorrect(opts) {
      var arr = ctx.body.querySelectorAll('.q-opt');
      opts.forEach(function (o, i) { if (o.ok) arr[i] && arr[i].classList.add('ans-ok'); });
    }
    function pick(o, btn, cur, opts) {
      locked = true; stopTimer();
      btn.classList.add(o.ok ? 'opt-ok' : 'opt-bad');
      if (!o.ok) revealCorrect(opts);
      ctx.award(o.ok, cur);
      ctx.sfx[o.ok ? 'good' : 'bad']();
      if (cfg.after) cfg.after(cur, o.ok);
      setTimeout(render, o.ok ? 650 : 1200);
    }
    function timeUp(cur, opts) {
      locked = true;
      revealCorrect(opts);
      ctx.award(false, cur);
      ctx.sfx.bad();
      showTip('⏰ 时间到！');
      setTimeout(render, 1100);
    }
    function showTip(t) {
      var tip = ctx.el('div', 'q-tip', t); ctx.body.appendChild(tip);
      setTimeout(function () { tip.remove(); }, 1000);
    }
    render();
  }

  function register(mode) { MODES.push(mode); }
  function list() { return MODES; }

  window.GameKit = {
    boot: function (store) { Store = store; },
    register: register, list: list,
    launch: launch, exit: exit, running: running,
    runQuiz: runQuiz, el: el,
    distractors: function (b, c, n) { return distractors(b, c, n); },
    nearSpellings: nearSpellings
  };
})();
