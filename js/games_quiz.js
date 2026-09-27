/* ============ 玩法 1-11：选择题族 + 拼写族 ============ */
(function () {
  'use strict';
  var GK = window.GameKit;
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function phon(cur) { return cur.ph ? '<span class="q-phon">' + esc(cur.ph) + '</span>' : ''; }

  function optsMeaning(ctx, cur) {
    var ds = ctx.distr(cur, 3);
    return ctx.shuffle([{ t: esc(cur.m), ok: true }].concat(ds.map(function (w) { return { t: esc(w.m), ok: false }; })));
  }
  function optsWord(ctx, cur) {
    var ds = ctx.distr(cur, 3);
    return ctx.shuffle([{ t: esc(cur.w), ok: true }].concat(ds.map(function (w) { return { t: esc(w.w), ok: false }; })));
  }
  function listen(ctx, cur) { ctx.speak(cur.w); }

  /* ---- 1 看词选义 ---- */
  GK.register({ id: 'w2m', icon: '📖', name: '看词选义', desc: '看单词，选中文意思', count: 10,
    run: function (ctx) { GK.runQuiz(ctx, { prompt: function (c) { return '<div class="q-big">' + esc(c.w) + '</div>' + phon(c); }, options: function (c) { return optsMeaning(ctx, c); } }); } });

  /* ---- 2 看义选词 ---- */
  GK.register({ id: 'm2w', icon: '🔤', name: '看义选词', desc: '看中文，选出对应单词', count: 10,
    run: function (ctx) { GK.runQuiz(ctx, { layout: 'grid2', prompt: function (c) { return '<div class="q-big q-cn">' + esc(c.m) + '</div>'; }, options: function (c) { return optsWord(ctx, c); } }); } });

  /* ---- 3 听音选义 ---- */
  GK.register({ id: 'a2m', icon: '🎧', name: '听音选义', desc: '听发音，选出中文意思', count: 10,
    run: function (ctx) { GK.runQuiz(ctx, { speakFirst: listen, prompt: function () { return '<div class="q-big">🔊</div><div class="q-sub">听发音，选意思（可点右下重听）</div>'; }, options: function (c) { return optsMeaning(ctx, c); },
      decorate: function (card) { var b = GK.el('button', 'q-replay', '🔊 重听'); b.onclick = function () { ctx.speak(ctx.words[ctx.s.i].w); }; card.appendChild(b); } }); } });

  /* ---- 4 听音选词 ---- */
  GK.register({ id: 'a2w', icon: '🔊', name: '听音选词', desc: '听发音，选出正确单词', count: 10,
    run: function (ctx) { GK.runQuiz(ctx, { speakFirst: listen, layout: 'grid2', prompt: function () { return '<div class="q-big">🔊</div><div class="q-sub">听发音，选单词</div>'; }, options: function (c) { return optsWord(ctx, c); },
      decorate: function (card) { var b = GK.el('button', 'q-replay', '🔊 重听'); b.onclick = function () { ctx.speak(ctx.words[ctx.s.i].w); }; card.appendChild(b); } }); } });

  /* ---- 5 首字母猜词 ---- */
  GK.register({ id: 'hint', icon: '🅰️', name: '首字母猜词', desc: '看释义+首字母，选单词', count: 10,
    run: function (ctx) { GK.runQuiz(ctx, { layout: 'grid2', speakFirst: listen,
      prompt: function (c) { var h = c.w[0] + new Array(Math.max(0, c.w.length - 1)).fill('_').join(' '); return '<div class="q-cn">' + esc(c.m) + '</div><div class="q-hint">' + esc(h) + '</div>'; },
      options: function (c) { return optsWord(ctx, c); } }); } });

  /* ---- 6 对错判断 ---- */
  GK.register({ id: 'judge', icon: '⚖️', name: '对错判断', desc: '单词和释义配不配？快速判断', count: 12,
    run: function (ctx) {
      GK.runQuiz(ctx, {
        prompt: function (c) {
          var ds = ctx.distr(c, 1);
          c._pair = Math.random() < 0.5 ? c.m : ds[0].m;
          c._match = c._pair === c.m;
          return '<div class="q-big">' + esc(c.w) + '</div><div class="q-pair">' + esc(c._pair) + '</div>';
        },
        options: function (c) {
          return ctx.shuffle([{ t: '✅ 配对正确', ok: c._match }, { t: '❌ 配对错误', ok: !c._match }]);
        },
        decorate: function (card) { card.querySelector('.q-opts').classList.add('two'); }
      });
    } });

  /* ---- 7 限时抢答 ---- */
  GK.register({ id: 'rush', icon: '⏱️', name: '限时抢答', desc: '6 秒一题，看义抢答', count: 10,
    run: function (ctx) { GK.runQuiz(ctx, { timed: 6000, layout: 'grid2', prompt: function (c) { return '<div class="q-big q-cn">' + esc(c.m) + '</div>'; }, options: function (c) { return optsWord(ctx, c); } }); } });

  /* ---- 8 火眼金睛·选正确拼写 ---- */
  GK.register({ id: 'spell', icon: '👁️', name: '火眼金睛', desc: '听发音，挑出拼写正确的那个', count: 10,
    run: function (ctx) {
      GK.runQuiz(ctx, { speakFirst: listen,
        prompt: function (c) { return '<div class="q-big">🔊</div><div class="q-sub">' + esc(c.m) + '</div>'; },
        options: function (c) {
          var wrongs = ctx.near(c.w, 3);
          return ctx.shuffle([{ t: esc(c.w), ok: true }].concat(wrongs.map(function (x) { return { t: esc(x), ok: false }; })));
        } });
    } });

  /* ---- 9 字母拼词（乱序重组） ---- */
  GK.register({ id: 'unscramble', icon: '🧩', name: '字母拼词', desc: '点字母拼出正确单词', count: 8,
    run: function (ctx) {
      var body = ctx.body, words = ctx.words, idx = 0;
      ctx.setHud();
      function render() {
        if (ctx.isOver()) return;
        if (idx >= words.length) return ctx.finish();
        var cur = words[idx]; ctx.s.i = idx; ctx.prog(); ctx.speak(cur.w);
        body.innerHTML = '';
        var card = ctx.el('div', 'q-card');
        card.appendChild(ctx.el('div', 'q-big q-cn', cur.m));
        var built = ctx.el('div', 'scr-built'); card.appendChild(built);
        var tiles = ctx.el('div', 'scr-tiles');
        var letters = ctx.shuffle(cur.w.split(''));
        var used = [];
        function refresh() { built.textContent = used.map(function (i) { return letters[i]; }).join('') || '\u00A0'; }
        refresh();
        letters.forEach(function (L, i) {
          var t = ctx.el('button', 'scr-tile', L);
          t.onclick = function () {
            if (used.indexOf(i) >= 0) return;
            used.push(i); t.disabled = true; t.classList.add('used'); ctx.sfx.pop(); refresh();
            if (used.length === cur.w.length) check();
          };
          tiles.appendChild(t);
        });
        card.appendChild(tiles);
        var row = ctx.el('div', 'scr-row');
        var bk = ctx.el('button', 'ghost-btn small', '↺ 重来'); bk.onclick = function () { used = []; Array.prototype.forEach.call(tiles.children, function (t) { t.disabled = false; t.classList.remove('used'); }); refresh(); };
        var sk = ctx.el('button', 'ghost-btn small', '⏭ 跳过'); sk.onclick = function () { ctx.award(false, cur); ctx.sfx.bad(); idx++; render(); };
        row.appendChild(bk); row.appendChild(sk); card.appendChild(row);
        body.appendChild(card);
        function check() {
          var guess = used.map(function (i) { return letters[i]; }).join('').toLowerCase();
          var ok = guess === cur.w.toLowerCase();
          built.classList.add(ok ? 'opt-ok' : 'opt-bad');
          ctx.award(ok, cur); ctx.sfx[ok ? 'good' : 'bad']();
          if (!ok) built.textContent = cur.w;
          setTimeout(function () { idx++; if (!ctx.isOver()) render(); }, ok ? 650 : 1200);
        }
      }
      render();
    } });

  /* ---- 10 补全单词（选字母填空） ---- */
  GK.register({ id: 'cloze', icon: '✏️', name: '补全单词', desc: '选出缺少的字母，补全单词', count: 10,
    run: function (ctx) {
      GK.runQuiz(ctx, { speakFirst: listen, layout: 'grid2',
        prompt: function (c) {
          var i = Math.floor(Math.random() * c.w.length);
          c._bi = i; c._bl = c.w[i];
          return '<div class="q-big q-mask">' + esc(c.w.split('').map(function (ch, k) { return k === i ? '＿' : ch; }).join(' ')) + '</div>';
        },
        options: function (c) {
          var set = {}, out = [];
          out.push({ t: esc(c._bl), ok: true }); set[c._bl.toLowerCase()] = 1;
          var tries = 0;
          while (out.length < 4 && tries < 40) {
            tries++;
            var L = String.fromCharCode(97 + Math.floor(Math.random() * 26));
            if (set[L]) continue; set[L] = 1; out.push({ t: L, ok: false });
          }
          return ctx.shuffle(out);
        },
        decorate: function (card) { var c = ctx.words[ctx.s.i]; if (c) card.querySelector('.q-prompt').appendChild(ctx.el('div', 'q-sub', c.m)); }
      });
    } });

  /* ---- 11 单词默写（键盘输入） ---- */
  GK.register({ id: 'dictation', icon: '⌨️', name: '单词默写', desc: '看释义，敲出单词全拼', count: 8,
    run: function (ctx) {
      var body = ctx.body, words = ctx.words, idx = 0;
      ctx.setHud();
      function render() {
        if (ctx.isOver()) return;
        if (idx >= words.length) return ctx.finish();
        var cur = words[idx]; ctx.s.i = idx; ctx.prog();
        body.innerHTML = '';
        var card = ctx.el('div', 'q-card');
        card.appendChild(ctx.el('div', 'q-big q-cn', cur.m));
        if (cur.ph) card.appendChild(ctx.el('div', 'q-phon', cur.ph));
        var inp = ctx.el('input', 'dt-input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.placeholder = '输入英文后回车'; inp.spellcheck = false;
        card.appendChild(inp);
        var btn = ctx.el('button', 'big-btn', '提交'); card.appendChild(btn);
        var tip = ctx.el('div', 'q-tip-inline'); card.appendChild(tip);
        body.appendChild(card);
        setTimeout(function () { inp.focus(); }, 50);
        ctx.speak(cur.w);
        function submit() {
          var v = inp.value.trim().toLowerCase();
          if (!v) return;
          var ok = v === cur.w.toLowerCase();
          ctx.award(ok, cur); ctx.sfx[ok ? 'good' : 'bad']();
          tip.className = 'q-tip-inline ' + (ok ? 'ok' : 'err');
          tip.textContent = ok ? '✔ 正确！' : '✘ 正确答案：' + cur.w;
          inp.disabled = true; btn.disabled = true;
          setTimeout(function () { idx++; if (!ctx.isOver()) render(); }, ok ? 700 : 1400);
        }
        btn.onclick = submit;
        inp.onkeydown = function (e) { if (e.key === 'Enter') submit(); };
      }
      render();
    } });
})();
