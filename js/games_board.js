/* ============ 玩法 12-20：棋盘配对 / 动作 / 记忆类 ============ */
(function () {
  'use strict';
  var GK = window.GameKit;
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function short(m) { return m.length > 12 ? m.slice(0, 12) + '…' : m; }

  /* ---------- 配对棋盘引擎：faceup / memory / adjacent / timed ---------- */
  function pairBoard(ctx, opt) {
    var body = ctx.body;
    var N = Math.min(opt.pairs || 6, ctx.words.length);
    var words = ctx.words.slice(0, N);
    ctx.s.total = N; // 进度分母改为配对数
    var tiles = [];
    words.forEach(function (w, i) {
      tiles.push({ k: 'w', ref: w, pid: i, txt: w.w });
      tiles.push({ k: 'm', ref: w, pid: i, txt: short(w.m) });
    });
    ctx.shuffle(tiles);
    var cols = opt.cols || 4;
    var matched = 0, sel = null, busy = false, misses = 0, wrongSet = [];
    var timeLimit = opt.timed || 0, t0 = Date.now();

    var wrap = ctx.el('div', 'board-wrap');
    var info = ctx.el('div', 'board-info');
    var grid = ctx.el('div', 'llk-grid'); grid.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
    var btns = tiles.map(function (t, idx) {
      var b = ctx.el('button', 'llk-tile');
      b.dataset.idx = idx;
      if (opt.mode === 'memory') b.classList.add('down');
      b.textContent = opt.mode === 'memory' ? '❓' : t.txt;
      b.onclick = function () { tap(idx, b); };
      grid.appendChild(b);
      return b;
    });
    wrap.appendChild(info); wrap.appendChild(grid); body.innerHTML = ''; body.appendChild(wrap);
    function up() { info.textContent = '已配对 ' + matched + '/' + N + (timeLimit ? ' · ⏱ ' + Math.max(0, Math.ceil((timeLimit * 1000 - (Date.now() - t0)) / 1000)) + 's' : ' · 失误 ' + misses); ctx.s.i = matched; ctx.prog(); ctx.setHud(); }

    var timer = null;
    if (timeLimit) {
      timer = setInterval(function () { up(); if (Date.now() - t0 > timeLimit * 1000) end(); }, 500);
      ctx.onCleanup(function () { clearInterval(timer); });
    }

    function pos(i) { return { r: Math.floor(i / cols), c: i % cols }; }
    function adjacent(a, b) { var pa = pos(a), pb = pos(b); return Math.abs(pa.r - pb.r) + Math.abs(pa.c - pb.c) === 1; }
    function alive() { var r = []; btns.forEach(function (b, i) { if (!b.classList.contains('gone')) r.push(i); }); return r; }
    function hasAdjPair() {
      var list = alive();
      for (var x = 0; x < list.length; x++) for (var y = x + 1; y < list.length; y++) {
        var i = list[x], j = list[y];
        if (adjacent(i, j) && tiles[i].pid === tiles[j].pid && tiles[i].k !== tiles[j].k) return true;
      }
      return false;
    }
    function reshuffleAlive() { // 对对碰无可消相邻对时，重排存活块避免无解
      var list = alive(); var objs = list.map(function (i) { return tiles[i]; });
      ctx.shuffle(objs);
      list.forEach(function (p, k) { tiles[p] = objs[k]; btns[p].textContent = (opt.mode === 'memory' && btns[p].classList.contains('down')) ? '❓' : objs[k].txt; });
    }
    function hideIfMemory(i) { var b = btns[i]; if (opt.mode === 'memory' && !b.classList.contains('gone')) { b.classList.add('down'); b.textContent = '❓'; } b.classList.remove('sel'); }

    function tap(idx, btn) {
      if (busy || btn.classList.contains('gone')) return;
      if (opt.mode === 'memory') { btn.classList.remove('down'); btn.textContent = tiles[idx].txt; }
      if (sel === null) { sel = idx; btn.classList.add('sel'); return; }
      if (sel === idx) { btn.classList.remove('sel'); if (opt.mode === 'memory') { btn.classList.add('down'); btn.textContent = '❓'; } sel = null; return; }
      var first = sel, second = idx, a = tiles[first], b = tiles[second];
      if (opt.mode === 'adjacent' && !adjacent(first, second)) { flash(btn); ctx.sfx.bad(); hideIfMemory(first); sel = null; return; }
      if (a.pid === b.pid && a.k !== b.k) { // 成功配对
        busy = true;
        btns[first].classList.add('gone'); btns[second].classList.add('gone');
        btns[first].classList.remove('sel');
        ctx.award(true, a.ref); matched++; sel = null; ctx.sfx.good(); up();
        if (matched === N) { busy = false; return end(); }
        if (opt.mode === 'adjacent' && !hasAdjPair()) reshuffleAlive();
        busy = false;
      } else { // 失误（写入错题本 + 刷新计数）
        misses++;
        ctx.award(false, a.ref);
        flash(btn); flash(btns[first]);
        setTimeout(function () { hideIfMemory(first); hideIfMemory(second); }, 460);
        sel = null; up();
      }
    }
    function flash(b) { b.classList.add('shake'); setTimeout(function () { b.classList.remove('shake'); }, 400); }
    function end() {
      if (timer) clearInterval(timer);
      ctx.finish({ right: matched, total: N, max: ctx.s.max, wrong: ctx.s.wrong, sub: (opt.name || '配对') + ' · 配对 ' + matched + '/' + N + '（失误 ' + misses + '）' });
    }
    up();
    if (opt.mode === 'adjacent' && !hasAdjPair()) reshuffleAlive();
  }

  /* ---------- 两列连线 ---------- */
  function columns(ctx) {
    var body = ctx.body;
    var N = Math.min(5, ctx.words.length);
    var words = ctx.words.slice(0, N);
    ctx.s.total = N;
    var left = ctx.shuffle(words.slice()), right = ctx.shuffle(words.slice());
    var done = 0, selW = null, selM = null, wrong = [];
    var box = ctx.el('div', 'col-match');
    function mkList(items, kind) {
      var ul = ctx.el('div', 'col ' + kind);
      items.forEach(function (w) {
        var b = ctx.el('button', 'col-item', kind === 'w' ? w.w : short(w.m));
        b.dataset.w = w.w;
        b.onclick = function () {
          if (b.classList.contains('ok')) return;
          if (kind === 'w') { clearSel(selW, ul); selW = b; } else { clearSel(selM, ul); selM = b; }
          b.classList.add('sel');
          if (selW && selM) judge();
        };
        ul.appendChild(b);
      });
      return ul;
    }
    function clearSel(node, ul) { if (node) node.classList.remove('sel'); }
    box.appendChild(mkList(left, 'w')); box.appendChild(mkList(right, 'm'));
    body.innerHTML = ''; body.appendChild(box);
    function judge() {
      var ok = selW.dataset.w === selM.dataset.w;
      if (ok) {
        selW.classList.remove('sel'); selM.classList.remove('sel');
        selW.classList.add('ok'); selM.classList.add('ok');
        var ref = words.find(function (w) { return w.w === selW.dataset.w; });
        ctx.award(true, ref); done++; ctx.sfx.good(); ctx.s.i = done; ctx.prog();
        if (done === N) ctx.finish({ right: N, total: N, wrong: [] });
      } else {
        var ref2 = words.find(function (w) { return w.w === selW.dataset.w; });
        if (ref2 && wrong.indexOf(ref2) < 0) wrong.push(ref2);
        ctx.s.combo = 0; ctx.setHud(); ctx.sfx.bad();
        selW.classList.add('shake'); selM.classList.add('shake');
        var a = selW, b = selM;
        setTimeout(function () { a.classList.remove('sel', 'shake'); b.classList.remove('sel', 'shake'); }, 450);
      }
      selW = selM = null;
    }
    ctx.setHud(); ctx.prog();
  }

  /* ---------- 打地鼠 ---------- */
  function mole(ctx) {
    var body = ctx.body, words = ctx.words, qi = 0, holes = [];
    var wrap = ctx.el('div', 'mole-wrap');
    var prompt = ctx.el('div', 'mole-prompt');
    var grid = ctx.el('div', 'mole-grid');
    for (var i = 0; i < 9; i++) { var h = ctx.el('div', 'mole-hole'); var m = ctx.el('div', 'mole'); h.appendChild(m); grid.appendChild(h); holes.push(m); }
    wrap.appendChild(prompt); wrap.appendChild(grid); body.innerHTML = ''; body.appendChild(wrap);
    var placed = -1;
    function nextTarget() { return words[qi]; }
    function spawn() {
      holes.forEach(function (m) { m.classList.remove('up'); });
      if (qi >= words.length) return;
      var cur = words[qi];
      // 正确答案地鼠 + 两个不重复的干扰词
      var ds = ctx.distr(cur, 2);
      var spots = ctx.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 3);
      spots.forEach(function (si, j) {
        var wordObj = j === 0 ? cur : ds[j - 1];
        if (!wordObj) return;
        var m = holes[si];
        m.textContent = wordObj.w;
        m.dataset.w = m.textContent;
        m.ref = wordObj;
        m.classList.add('up');
      });
    }
    function tap(e) {
      var m = e.target.closest ? e.target.closest('.mole') : null;
      if (!m || !m.classList.contains('up') || qi >= words.length) return;
      if (m.dataset.w === words[qi].w) { ctx.award(true, words[qi]); ctx.sfx.good(); m.classList.remove('up'); qi++; ctx.s.i = qi; ctx.prog(); prompt.innerHTML = '🎯 ' + esc(short(words[Math.min(qi, words.length - 1)].m)); if (qi >= words.length) return finish(); }
      else { ctx.award(false, words[qi]); ctx.sfx.bad(); m.classList.remove('up'); }
    }
    grid.addEventListener('pointerdown', tap);
    ctx.onCleanup(function () { grid.removeEventListener('pointerdown', tap); clearInterval(loop); });
    var loop = setInterval(spawn, 1100);
    prompt.innerHTML = '🎯 ' + esc(short(words[0].m));
    ctx.speak(words[0].w); spawn();
    function finish() { clearInterval(loop); ctx.finish({ right: ctx.s.right, total: words.length }); }
    ctx.setHud();
  }

  /* ---------- 泡泡消消（上升的单词泡泡，点正确的） ---------- */
  function bubbles(ctx) {
    var body = ctx.body, words = ctx.words, qi = 0;
    var stage = ctx.el('div', 'bub-stage');
    var prompt = ctx.el('div', 'bub-prompt', '🎯 ' + esc(short(words[0].m)));
    stage.appendChild(prompt); body.innerHTML = ''; body.appendChild(stage);
    function hasTargetOnScreen() {
      var arr = stage.querySelectorAll('.bub');
      for (var i = 0; i < arr.length; i++) if (arr[i].dataset.w === words[qi].w) return true;
      return false;
    }
    function addBubble(wordObj) {
      if (!wordObj) return;
      var b = ctx.el('div', 'bub', wordObj.w);
      b.dataset.w = wordObj.w; b.ref = wordObj;
      b.style.left = (6 + Math.random() * 80) + '%';
      b.style.animationDuration = (4.5 + Math.random() * 3) + 's';
      b.onclick = function () {
        if (qi >= words.length || b.classList.contains('pop')) return;
        if (b.dataset.w === words[qi].w) { ctx.award(true, words[qi]); ctx.sfx.good(); pop(b); qi++; ctx.s.i = qi; ctx.prog(); if (qi < words.length) { prompt.textContent = '🎯 ' + esc(short(words[qi].m)); ctx.speak(words[qi].w); } else finish(); }
        else { ctx.award(false, words[qi]); ctx.sfx.bad(); pop(b); }
      };
      stage.appendChild(b);
      setTimeout(function () { if (b.parentNode) b.remove(); }, 8000);
    }
    function pop(b) { b.classList.add('pop'); setTimeout(function () { b.remove(); }, 260); }
    var loop = setInterval(function () {
      if (qi >= words.length) return;
      var cur = words[qi];
      if (!hasTargetOnScreen()) addBubble(cur);            // 目标词不在场上才补，避免重复堆积
      else if (stage.querySelectorAll('.bub').length < 7) addBubble(ctx.distr(cur, 1)[0]); // 否则补干扰词
    }, 850);
    ctx.onCleanup(function () { clearInterval(loop); });
    addBubble(words[0]); addBubble(ctx.distr(words[0], 1)[0]); ctx.speak(words[0].w);
    function finish() { clearInterval(loop); ctx.finish({ right: ctx.s.right, total: words.length }); }
    ctx.setHud();
  }

  /* ---------- 记忆序列：闪现单词，回忆哪些出现过 ---------- */
  function recall(ctx) {
    var body = ctx.body, bank = ctx.Store.getBank(ctx.bankId);
    var rounds = Math.min(3, Math.floor(ctx.words.length / 3)) || 1;
    ctx.s.total = rounds;
    var round = 0, right = 0, total = 0, wrong = [];
    function startRound() {
      ctx.s.i = round; ctx.prog();
      var seen = ctx.shuffle(bank.words.slice()).slice(0, 5);
      var dummy = ctx.shuffle(bank.words.filter(function (w) { return seen.indexOf(w) < 0; })).slice(0, 5);
      var opts = ctx.shuffle(seen.concat(dummy));
      total += seen.length;
      // 记忆阶段
      body.innerHTML = '';
      var card = ctx.el('div', 'q-card');
      card.appendChild(ctx.el('div', 'q-sub', '第 ' + (round + 1) + '/' + rounds + ' 轮 · 记住这些单词'));
      var list = ctx.el('div', 'rec-list');
      seen.forEach(function (w) { var c = ctx.el('div', 'rec-word', w.w); c.title = w.m; list.appendChild(c); ctx.speak(w.w); });
      card.appendChild(list); body.appendChild(card);
      var to = setTimeout(question, 4200);
      ctx.onCleanup(function () { clearTimeout(to); });
      function question() {
        body.innerHTML = '';
        var card2 = ctx.el('div', 'q-card');
        card2.appendChild(ctx.el('div', 'q-sub', '哪些是你刚才见过的？点选它们'));
        var grid = ctx.el('div', 'rec-opts');
        var picked = 0;
        opts.forEach(function (w) {
          var b = ctx.el('button', 'rec-opt', w.w);
          b.onclick = function () {
            if (b.classList.contains('done')) return;
            b.classList.add('done');
            var isSeen = seen.indexOf(w) >= 0;
            ctx.Store.markLearned(w.w, isSeen);
            if (isSeen) { b.classList.add('opt-ok'); right++; ctx.sfx.good(); }
            else { b.classList.add('opt-bad'); if (wrong.indexOf(w) < 0) { wrong.push(w); ctx.Store.addMistake(w); } ctx.sfx.bad(); }
            picked++; ctx.setHud();
            if (picked >= seen.length + 2) {
              ctx.s.score += right * 8;
              setTimeout(function () { round++; if (round >= rounds) fin(); else startRound(); }, 700);
            }
          };
          grid.appendChild(b);
        });
        card2.appendChild(grid); body.appendChild(card2);
      }
    }
    function fin() { ctx.finish({ right: right, total: total, wrong: wrong, score: ctx.s.score, sub: '记忆序列 · 记对 ' + right + '/' + total }); }
    ctx.setHud(); startRound();
  }

  /* ---------- 拖拽归位：点单词→点对应释义槽位 ---------- */
  function place(ctx) {
    var body = ctx.body;
    var N = Math.min(5, ctx.words.length), words = ctx.words.slice(0, N);
    ctx.s.total = N;
    var done = 0, sel = null, wrong = [];
    var wrap = ctx.el('div', 'place-wrap');
    var chips = ctx.el('div', 'place-chips');
    var slots = ctx.el('div', 'place-slots');
    ctx.shuffle(words.slice()).forEach(function (w) {
      var c = ctx.el('button', 'chip', w.w); c.dataset.w = w.w;
      c.onclick = function () { if (c.classList.contains('gone')) return; if (sel) sel.classList.remove('sel'); sel = c; c.classList.add('sel'); };
      chips.appendChild(c);
    });
    ctx.shuffle(words.slice()).forEach(function (w) {
      var s = ctx.el('div', 'slot'); s.innerHTML = '<span class="slot-m">' + esc(short(w.m)) + '</span>';
      s.onclick = function () {
        if (!sel || s.classList.contains('filled')) return;
        if (sel.dataset.w === w.w) {
          s.classList.add('filled'); s.insertAdjacentHTML('afterbegin', '<b class="slot-w">' + esc(w.w) + '</b>');
          sel.classList.remove('sel'); sel.classList.add('gone');
          ctx.award(true, w); ctx.sfx.good(); done++; ctx.s.i = done; ctx.prog(); sel = null;
          if (done === N) ctx.finish({ right: N, total: N, wrong: [] });
        } else {
          if (wrong.indexOf(w) < 0) wrong.push(w);
          ctx.s.combo = 0; ctx.setHud(); ctx.sfx.bad(); s.classList.add('shake'); setTimeout(function () { s.classList.remove('shake'); }, 450);
        }
      };
      slots.appendChild(s);
    });
    wrap.appendChild(chips); wrap.appendChild(slots); body.innerHTML = ''; body.appendChild(wrap);
    ctx.setHud(); ctx.prog();
  }

  /* ---------- 注册 12-20 ---------- */
  GK.register({ id: 'llk', icon: '🔗', name: '连连看', desc: '点选单词与释义配对消除', count: 12, need: 6, run: function (ctx) { pairBoard(ctx, { mode: 'faceup', pairs: 6, cols: 4, name: '连连看' }); } });
  GK.register({ id: 'memory', icon: '🃏', name: '记忆翻牌', desc: '翻开卡片，记住位置配对', count: 12, need: 6, run: function (ctx) { pairBoard(ctx, { mode: 'memory', pairs: 6, cols: 4, name: '记忆翻牌' }); } });
  GK.register({ id: 'blast', icon: '💥', name: '对对碰', desc: '碰相邻的单词与释义消除', count: 12, need: 6, run: function (ctx) { pairBoard(ctx, { mode: 'adjacent', pairs: 6, cols: 4, name: '对对碰' }); } });
  GK.register({ id: 'lines', icon: '↔️', name: '两列连线', desc: '左列单词连右列释义', count: 5, need: 5, run: columns });
  GK.register({ id: 'mole', icon: '🐹', name: '打地鼠', desc: '按释义猛点正确的单词地鼠', count: 8, need: 4, run: mole });
  GK.register({ id: 'bub', icon: '🫧', name: '泡泡消消', desc: '点破上升中的正确单词泡泡', count: 8, need: 4, run: bubbles });
  GK.register({ id: 'recall', icon: '🧠', name: '记忆序列', desc: '闪现单词，回忆谁出现过', count: 9, need: 3, run: recall });
  GK.register({ id: 'place', icon: '📥', name: '单词归位', desc: '点单词再点对应释义槽位', count: 5, need: 5, run: place });
  GK.register({ id: 'speed', icon: '⚡', name: '极速配对', desc: '40 秒限时配对冲刺', count: 16, need: 8, run: function (ctx) { pairBoard(ctx, { mode: 'faceup', pairs: 8, cols: 4, timed: 40, name: '极速配对' }); } });
})();
