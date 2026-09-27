/* ============ vocab-hub 数据层：词库 + 学习记录（localStorage 统一 vh_ 前缀） ============ */
(function () {
  'use strict';

  var PREFIX = 'vh_';

  // 内置词库注册表：新增词库只需在此加一行 + 放一个 data/xxx.json，游戏代码零改动
  var BUILTIN_BANKS = [
    { id: 'toeic', url: 'data/toeic.json' }
  ];

  function lsGet(key, dflt) {
    try {
      var v = localStorage.getItem(PREFIX + key);
      return v === null ? dflt : JSON.parse(v);
    } catch (e) { return dflt; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) {}
  }

  /* ---------- 词库 ---------- */
  var banks = {};       // id -> 词库对象（含 words）
  var customMeta = null; // 自定义词库元数据列表

  function loadBanks(onDone) {
    // 1. 内置词库
    var pending = BUILTIN_BANKS.length;
    BUILTIN_BANKS.forEach(function (b) {
      fetch(b.url)
        .then(function (r) { return r.json(); })
        .then(function (data) { banks[b.id] = data; if (--pending === 0) finish(); })
        .catch(function (err) { console.warn('词库加载失败', b.url, err); if (--pending === 0) finish(); });
    });
    if (pending === 0) finish();
    function finish() { onDone && onDone(api.listBanks()); }
  }

  function customList() {
    if (!customMeta) customMeta = lsGet('banks', []);
    return customMeta;
  }

  function addCustomBank(name, words) {
    var id = 'custom_' + Date.now();
    var bank = { id: id, name: name, icon: '📝', desc: '自定义导入 · ' + words.length + ' 词', levels: ['easy'], words: words };
    banks[id] = bank;
    customList().push({ id: id, name: name, icon: '📝', desc: bank.desc, words: words });
    lsSet('banks', customMeta);
    return bank;
  }

  function removeCustomBank(id) {
    delete banks[id];
    customMeta = customList().filter(function (b) { return b.id !== id; });
    lsSet('banks', customMeta);
  }

  function getBank(id) {
    if (banks[id]) return banks[id];
    // 自定义词库从 localStorage 恢复
    var c = customList().find(function (b) { return b.id === id; });
    if (c) banks[id] = c;
    return banks[id] || null;
  }

  /* ---------- 难度筛选 + 出题 ---------- */
  function pickWords(bankId, level, count) {
    var bank = getBank(bankId);
    if (!bank) return [];
    var pool = level === 'all' ? bank.words : bank.words.filter(function (w) { return w.level === level; });
    if (pool.length === 0) pool = bank.words;
    pool = shuffle(pool.slice());
    var out = pool.slice(0, Math.min(count, pool.length));
    // 词不够时循环补足（选择题选项仍需去重）
    while (out.length < count && pool.length > 0) out.push(pool[out.length % pool.length]);
    return out;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------- 掌握度 ---------- */
  function learnedMap() { return lsGet('learned', {}); }

  function markLearned(word, right) {
    var m = learnedMap();
    var n = (m[word] || 0) + (right ? 1 : -2);
    if (n <= 0) delete m[word];
    if (n > 3) n = 3;
    m[word] = n;
    lsSet('learned', m);
  }

  function learnedCount() {
    var m = learnedMap(), n = 0;
    for (var k in m) if (m[k] >= 2) n++;
    return n;
  }

  /* ---------- 错题本 ---------- */
  function mistakes() { return lsGet('mistakes', []); }

  function addMistake(wordObj) {
    var list = mistakes();
    var exist = list.find(function (x) { return x.w === wordObj.w; });
    if (exist) { exist.n = (exist.n || 1) + 1; exist.time = Date.now(); }
    else list.push({ w: wordObj.w, ph: wordObj.ph, m: wordObj.m, level: wordObj.level, n: 1, time: Date.now() });
    list.sort(function (a, b) { return (b.n - a.n) || (b.time - a.time); });
    if (list.length > 100) list = list.slice(0, 100);
    lsSet('mistakes', list);
  }

  function removeMistake(word) {
    lsSet('mistakes', mistakes().filter(function (x) { return x.w !== word; }));
  }

  function clearMistakes() { lsSet('mistakes', []); }

  /* ---------- 打卡 ---------- */
  function dayKey(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function todayStr() { return dayKey(new Date()); }

  function checkin() {
    var t = todayStr();
    if (lsGet('last_in', '') === t) return streak(); // 今天已打
    var y = new Date(); y.setDate(y.getDate() - 1);
    var s = (lsGet('last_in', '') === dayKey(y)) ? lsGet('streak_n', 0) + 1 : 1;
    lsSet('streak_n', s);
    lsSet('last_in', t);
    var days = lsGet('days', []);
    days.push(t);
    if (days.length > 366) days = days.slice(-366);
    lsSet('days', days);
    return s;
  }

  // 展示用：今天或昨天打过才显示连击数，否则中断清零
  function streak() {
    var li = lsGet('last_in', '');
    if (!li) return 0;
    var y = new Date(); y.setDate(y.getDate() - 1);
    if (li === todayStr() || li === dayKey(y)) return lsGet('streak_n', 0);
    return 0;
  }

  function checkedToday() {
    return lsGet('last_in', '') === todayStr();
  }

  function recentDots(n) {
    var days = {}, out = [], d = new Date();
    lsGet('days', []).forEach(function (x) { days[x] = 1; });
    d.setDate(d.getDate() - n + 1);
    for (var i = 0; i < n; i++) {
      out.push(!!days[dayKey(d)]);
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /* ---------- 最高分 ---------- */
  function best(key, val) {
    var cur = lsGet(key, 0);
    if (val > cur) { lsSet(key, val); return val; }
    return cur;
  }

  /* ---------- 累计统计 ---------- */
  function get(key) { return lsGet(key, 0); }

  function bump(key, n) {
    var v = get(key) + (n || 1);
    lsSet(key, v);
    return v;
  }

  /* ---------- 成就 ---------- */
  var ACHIEVEMENTS = [
    { id: 'first_game',  icon: '🌟', name: '初次启程',   desc: '完成第一局游戏',          test: function (s) { return s.games >= 1; } },
    { id: 'streak_7',    icon: '🔥', name: '七日之约',   desc: '连续打卡 7 天',           test: function (s) { return s.streak >= 7; } },
    { id: 'learn_50',    icon: '📖', name: '小有所成',   desc: '掌握 50 个单词',          test: function (s) { return s.learned >= 50; } },
    { id: 'learn_200',   icon: '🎓', name: '词汇达人',   desc: '掌握 200 个单词',         test: function (s) { return s.learned >= 200; } },
    { id: 'combo_10',    icon: '⚡', name: '十连斩',     desc: '射击模式达成 10 连击',    test: function (s) { return s.maxCombo >= 10; } },
    { id: 'shoot_500',   icon: '🏆', name: '神枪手',     desc: '射击模式单局 500 分',     test: function (s) { return s.bestShooter >= 500; } },
    { id: 'listen_10',   icon: '🎧', name: '顺风耳',     desc: '听音模式一次全对',        test: function (s) { return s.bestListen >= 10; } },
    { id: 'clear_mist',  icon: '🧹', name: '错题清零',   desc: '把错题本复习到空',        test: function (s) { return s.clearedOnce; } }
  ];

  function achUnlocked() { return lsGet('ach', {}); }

  function checkAchievements(state) {
    var got = achUnlocked(), newly = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (!got[a.id] && a.test(state)) { got[a.id] = 1; newly.push(a); }
    });
    lsSet('ach', got);
    return newly;
  }

  function achList(state) {
    var got = achUnlocked();
    return ACHIEVEMENTS.map(function (a) {
      return { icon: a.icon, name: a.name, desc: a.desc, unlocked: !!got[a.id] };
    });
  }

  /* ---------- 发音（Web Speech API） ---------- */
  var voicesReady = false;
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = function () { voicesReady = true; };
  }
  function speak(word) {
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.9;
    var vs = speechSynthesis.getVoices();
    if (voicesReady || vs.length) {
      var pref = vs.find(function (v) { return /^en(-|_)?US/i.test(v.lang) && /female|zira|samantha/i.test(v.name); })
        || vs.find(function (v) { return /^en/i.test(v.lang); });
      if (pref) u.voice = pref;
    }
    speechSynthesis.speak(u);
    return true;
  }

  /* ---------- 音效（Web Audio API 轻量合成） ---------- */
  var actx = null;
  function tone(freq, dur, type, delay, gain) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      var t = actx.currentTime + (delay || 0);
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  var sfx = {
    shoot:  function () { tone(880, 0.06, 'square', 0, 0.05); },
    good:   function () { tone(660, 0.09); tone(880, 0.12, 'sine', 0.07); },
    bad:    function () { tone(220, 0.2, 'sawtooth', 0, 0.06); },
    pop:    function () { tone(520, 0.07, 'triangle'); },
    win:    function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.14, 'sine', i * 0.09); }); },
    ach:    function () { [784, 988, 1175].forEach(function (f, i) { tone(f, 0.16, 'triangle', i * 0.1); }); }
  };

  /* ---------- 导出 ---------- */
  var api = {
    loadBanks: loadBanks,
    listBanks: function () {
      var out = BUILTIN_BANKS.map(function (b) { return banks[b.id]; }).filter(Boolean);
      return out.concat(customList());
    },
    getBank: getBank,
    addCustomBank: addCustomBank,
    removeCustomBank: removeCustomBank,
    pickWords: pickWords, shuffle: shuffle,
    markLearned: markLearned, learnedCount: learnedCount, learnedMap: learnedMap,
    mistakes: mistakes, addMistake: addMistake, removeMistake: removeMistake, clearMistakes: clearMistakes,
    checkin: checkin, streak: streak, checkedToday: checkedToday, recentDots: recentDots,
    best: best, get: get, bump: bump,
    achList: achList, checkAchievements: checkAchievements,
    speak: speak, sfx: sfx,
    resetAll: function () {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k); });
    }
  };

  window.Store = api;
})();
