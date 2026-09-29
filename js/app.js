/* ============ vocab-hub 主控：导航 / 词库 / 统计 / 导入 / 错题 / 成就 ============ */
(function () {
  'use strict';

  var S = window.Store;
  var GameKit = window.GameKit;
  GameKit.boot(S);
  window.VHShooter.boot(S);
  window.VHListen.boot(S);
  window.VHStore = S;

  var state = { bankId: 'primary', level: 'all', lastMode: 'shooter' };

  function $(id) { return document.getElementById(id); }

  /* ---------- 页面切换 ---------- */
  function show(page) {
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    $('page-' + page).classList.add('active');
    window.scrollTo(0, 0);
  }

  function currentWords(count) {
    return S.pickWords(state.bankId, state.level, count || 10);
  }

  /* ---------- 首页渲染 ---------- */
  function renderBanks() {
    var box = $('bank-list');
    box.innerHTML = '';
    var banks = S.listBanks();
    if (!banks.length) {
      box.innerHTML = '<div class="bank-desc">词库加载中…（请通过 http 服务打开，file:// 下 fetch 受限）</div>';
      return;
    }
    banks.forEach(function (b) {
      var el = document.createElement('div');
      el.className = 'bank-item' + (b.id === state.bankId ? ' selected' : '');
      el.innerHTML = '<div class="bank-icon">' + (b.icon || '📚') + '</div>'
        + '<div><div class="bank-name"></div><div class="bank-desc"></div></div>'
        + '<div class="bank-cnt">' + b.words.length + ' 词</div>';
      el.querySelector('.bank-name').textContent = b.name;
      el.querySelector('.bank-desc').textContent = b.desc || '';
      el.onclick = function () { state.bankId = b.id; renderBanks(); };
      // 自定义词库可删除
      if (b.id.indexOf('custom_') === 0) {
        var del = document.createElement('button');
        del.className = 'bank-del';
        del.textContent = '✕';
        del.title = '删除该词库';
        del.onclick = function (e) {
          e.stopPropagation();
          if (confirm('删除「' + b.name + '」？')) {
            S.removeCustomBank(b.id);
            if (state.bankId === b.id) state.bankId = S.listBanks()[0].id;
            renderBanks();
          }
        };
        el.appendChild(del);
      }
      box.appendChild(el);
    });
  }

  function renderStats() {
    $('streak-num').textContent = S.streak();
    $('learned-num').textContent = S.learnedCount();
    $('best-shooter-num').textContent = S.best('best_shooter', 0);
    $('best-listen-num').textContent = S.best('best_listen', 0);
    $('mistake-count').textContent = S.mistakes().length;
    $('checkin-text').textContent = S.checkedToday() ? '今天已打卡，继续保持！✨' : '完成一局即可打卡～';
    var dots = $('today-dots');
    dots.innerHTML = '';
    S.recentDots(7).forEach(function (on) {
      var d = document.createElement('i');
      d.className = 'dot' + (on ? ' on' : '');
      dots.appendChild(d);
    });
  }

  /* ---------- 错题本 ---------- */
  function renderMistakes() {
    var list = S.mistakes();
    $('mk-empty').classList.toggle('hidden', list.length > 0);
    var box = $('mk-list');
    box.innerHTML = '';
    list.forEach(function (m) {
      var el = document.createElement('div');
      el.className = 'mk-item';
      el.innerHTML = '<div><div class="mk-w"></div><div class="mk-m"></div></div>'
        + '<div class="mk-n">错 ' + (m.n || 1) + ' 次</div>'
        + '<button class="mk-speak" title="播放发音">🔊</button>';
      el.querySelector('.mk-w').textContent = m.w + '  ' + (m.ph || '');
      el.querySelector('.mk-m').textContent = m.m;
      el.querySelector('.mk-speak').onclick = function (ev) { ev.stopPropagation(); S.speak(m.w, 3); };
      el.onclick = function () {
        if (confirm('从错题本移除「' + m.w + '」？')) {
          S.removeMistake(m.w);
          renderMistakes(); renderStats();
        }
      };
      box.appendChild(el);
    });
  }

  /* ---------- 成就 ---------- */
  function achState(extra) {
    var st = {
      games: S.get('games'),
      streak: S.streak(),
      learned: S.learnedCount(),
      bestShooter: S.best('best_shooter', 0),
      bestListen: S.best('best_listen', 0),
      maxCombo: S.best('max_combo', 0),
      clearedOnce: !!localStorage.getItem('vh_cleared_once')
    };
    if (extra) for (var k in extra) st[k] = extra[k];
    return st;
  }

  function renderAchievements() {
    var box = $('ach-list');
    box.innerHTML = '';
    S.achList(achState()).forEach(function (a) {
      var el = document.createElement('div');
      el.className = 'ach-item' + (a.unlocked ? '' : ' locked');
      el.innerHTML = '<div class="ach-icon"></div><div><div class="ach-name"></div><div class="ach-desc"></div></div>'
        + '<div class="ach-state">' + (a.unlocked ? '已达成' : '未解锁') + '</div>';
      el.querySelector('.ach-icon').textContent = a.icon;
      el.querySelector('.ach-name').textContent = a.name;
      el.querySelector('.ach-desc').textContent = a.desc;
      box.appendChild(el);
    });
  }

  function toastAchievements(newly) {
    newly.forEach(function (a, i) {
      setTimeout(function () {
        var t = document.createElement('div');
        t.className = 'ach-toast';
        t.textContent = '🏅 达成成就：' + a.name;
        document.body.appendChild(t);
        S.sfx.ach();
        setTimeout(function () { t.remove(); }, 2900);
      }, i * 900);
    });
  }

  /* ---------- 导入词库 ---------- */
  function doImport() {
    var msg = $('im-msg');
    msg.className = 'im-msg';
    var name = $('im-name').value.trim() || '我的生词本';
    var text = $('im-text').value.trim();
    var words = [];

    // 尝试 JSON
    var raw = text;
    if (!raw && !fileData) { msg.textContent = '请粘贴文本或选择文件'; msg.classList.add('err'); return; }
    var fromFile = !raw && fileData;
    if (fromFile) raw = fileData;
    try {
      var json = JSON.parse(raw || fileData);
      if (Array.isArray(json)) {
        words = json.map(function (x) {
          if (typeof x === 'string') { var p = x.split(/[,，\t]/); return { w: p[0].trim(), m: (p[1] || '').trim() }; }
          return { w: x.w || x.word, ph: x.ph || x.phonetic, m: x.m || x.meaning || x.cn || x.def, level: x.level || 'easy' };
        }).filter(function (x) { return x.w && x.m; });
      } else if (json.words) {
        words = json.words;
      }
    } catch (e) {
      // 逐行 text 格式：word, 释义（文件模式下单行 JSON 数组也能重试解析）
      if (fromFile) { fileData = null; return doImport(); }
      words = (raw || '').split(/\r?\n/).map(function (line) {
        var m = line.match(/^\s*([A-Za-z][A-Za-z'’\-. ]*?)\s*[,，\t:：]\s*(.+?)\s*$/);
        return m ? { w: m[1], m: m[2], level: 'easy' } : null;
      }).filter(Boolean);
    }

    fileData = null;
    if (words.length < 4) { msg.textContent = '有效单词不足 4 个（至少 4 个才能正常出题）'; msg.classList.add('err'); return; }
    words.forEach(function (w) { if (!w.level) w.level = 'easy'; });
    S.addCustomBank(name, words);
    state.bankId = S.listBanks()[S.listBanks().length - 1].id;
    renderBanks();
    msg.textContent = '✅ 成功导入 ' + words.length + ' 个单词！';
    msg.classList.add('ok');
    $('im-text').value = ''; $('im-name').value = '';
  }

  var fileData = null;

  /* ---------- 结果页 ---------- */
  function showResult(r) {
    $('result-emoji').textContent = r.emoji;
    $('result-title').textContent = r.title;
    $('result-sub').textContent = r.sub;
    var box = $('result-stats');
    box.innerHTML = '';
    r.stats.forEach(function (s) {
      var el = document.createElement('div');
      el.className = 'rstat';
      el.innerHTML = '<div class="n"></div><div class="l">' + s.l + '</div>';
      el.querySelector('.n').textContent = s.n;
      box.appendChild(el);
    });
    var nw = $('result-newwords');
    if (r.wrongWords && r.wrongWords.length) {
      nw.innerHTML = '📕 本局错题：' + r.wrongWords.map(function (w) { return w.w; }).join('、') + '（已加入错题本）';
    } else {
      nw.textContent = '🌱 全部答对，没有错题！';
    }
    state.lastMode = r.mode;
    show('result');
    S.checkin(); // 完成一局即打卡
  }

  function onGameEnd(extra) {
    if (extra.mode === 'shooter' && extra.maxCombo) S.best('max_combo', extra.maxCombo);
    if (extra.allRight && S.mistakes().length === 0) localStorage.setItem('vh_cleared_once', '1');
    // 先修正 games 计数读取方式
    var newly = S.checkAchievements(achState(extra));
    toastAchievements(newly);
  }

  /* ---------- 玩法：legacy（射击/听音）+ 数据驱动 20 种 ---------- */
  var LEGACY = [
    { id: 'shooter', icon: '🔫', name: '单词射击', desc: '打飞机认单词，连击冲高分', kind: 'legacy' },
    { id: 'listen', icon: '🎧', name: '听音挑战', desc: '听发音选释义，练听力语感', kind: 'legacy' }
  ];
  function allModes() { return LEGACY.concat(GameKit.list()); }

  function buildModeGrid() {
    var box = $('mode-grid'); if (!box) return;
    box.innerHTML = '';
    allModes().forEach(function (m) {
      var c = document.createElement('div');
      c.className = 'mode-cell';
      c.innerHTML = '<div class="mc-icon">' + m.icon + '</div><div class="mc-name"></div><div class="mc-desc"></div>';
      c.querySelector('.mc-name').textContent = m.name;
      c.querySelector('.mc-desc').textContent = m.desc;
      c.onclick = function () { launchMode(m.id); };
      box.appendChild(c);
    });
  }

  function launchMode(id) {
    var m = allModes().find(function (x) { return x.id === id; });
    if (!m) return;
    state.lastMode = id;
    if (m.kind === 'legacy') {
      if (id === 'shooter') { show('shooter'); window.VHShooter.start(currentWords(10), state.bankId); }
      else { show('listen'); window.VHListen.start(currentWords(10), state.bankId); }
    } else {
      GameKit.launch(m, { bankId: state.bankId, level: state.level });
    }
  }

  function showGame(mode) {
    $('g-title').textContent = mode.icon + ' ' + mode.name;
    $('game-body').innerHTML = '';
    show('game');
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    buildModeGrid();
    $('game-exit').onclick = function () { GameKit.exit(); show('home'); renderStats(); };
    document.querySelectorAll('[data-exit]').forEach(function (b) {
      b.onclick = function () {
        var which = b.getAttribute('data-exit');
        if (which === 'shooter') window.VHShooter.stop();
        if (which === 'listen') window.VHListen.stop();
        GameKit.exit();
        show('home'); renderStats();
      };
    });
    $('result-again').onclick = function () { launchMode(state.lastMode || 'shooter'); };
    $('result-home').onclick = function () { show('home'); renderStats(); };

    $('go-mistakes').onclick = function () { renderMistakes(); show('mistakes'); };
    $('go-achievements').onclick = function () { renderAchievements(); show('achievements'); };
    $('go-import').onclick = function () { show('import'); };
    $('mk-clear').onclick = function () {
      if (S.mistakes().length && confirm('清空错题本？')) { S.clearMistakes(); renderMistakes(); renderStats(); }
    };

    document.querySelectorAll('.level-btn').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.level-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        state.level = b.getAttribute('data-level');
      };
    });

    $('im-file').onchange = function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        fileData = reader.result;
        $('im-text').value = '';
        $('im-msg').textContent = '已读取文件：' + f.name;
        $('im-msg').className = 'im-msg ok';
      };
      reader.readAsText(f, 'utf-8');
    };
    $('im-do').onclick = doImport;
  }

  /* ---------- 启动 ---------- */
  function init() {
    bind();
    S.loadBanks(function (banks) {
      if (banks.length && !S.getBank(state.bankId)) state.bankId = banks[0].id;
      renderBanks();
      renderStats();
    });
  }

  window.VHApp = { showResult: showResult, onGameEnd: onGameEnd, showGame: showGame };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
