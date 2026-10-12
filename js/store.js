/* ============ vocab-hub 数据层：词库 + 学习记录（localStorage 统一 vh_ 前缀） ============ */
(function () {
  'use strict';

  var PREFIX = 'vh_';

  // 内置词库注册表：新增词库只需放 data/xxx.json + 在此加一行 id，再运行 tools/build_datajs.py
  // 运行时数据来自内联的 js/data.js（window.VHBANKS），使应用可在 file:// 双击直接运行，无需服务器
  var BUILTIN_BANKS = [
    { id: 'primary' },
    { id: 'junior' },
    { id: 'senior' },
    { id: 'toeic' },
    { id: 'kaoyan' },
    { id: 'toefl' },
    { id: 'ielts' }
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
    // 词库数据由 js/data.js 内联提供（window.VHBANKS），同步装载，兼容 file:// 双击运行
    var V = (typeof window !== 'undefined' && window.VHBANKS) || {};
    BUILTIN_BANKS.forEach(function (b) {
      if (V[b.id]) banks[b.id] = V[b.id];
      else console.warn('内联词库缺失', b.id);
    });
    if (onDone) onDone(api.listBanks());
    migrateLog();
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
    return n;
  }

  function learnedCount() {
    var m = learnedMap(), n = 0;
    for (var k in m) if (m[k] >= 2) n++;
    return n;
  }

  /* ---------- 单词级学习日志（vh_log：每个词一条，报告的数据源） ---------- */
  var LOG_CAP = 4000;      // 最多留 4000 词，超出淘汰最久未接触的
  var DAILY_CAP = 366;     // 每日统计保留一年

  function wordLog() { return lsGet('log', {}); }

  function saveLog(log) {
    var keys = Object.keys(log);
    if (keys.length > LOG_CAP) {
      keys.sort(function (a, b) { return log[a].lt - log[b].lt; });
      keys.slice(0, keys.length - LOG_CAP).forEach(function (k) { delete log[k]; });
    }
    lsSet('log', log);
  }

  // e: { w, m, ph, lv, bk, ft 首次, lt 最近, n 接触次数, ok 答对, bad 答错 }
  function logAnswer(wordObj, bankId, right) {
    var log = wordLog(), now = Date.now();
    var e = log[wordObj.w];
    if (!e) {
      e = { w: wordObj.w, m: wordObj.m || '', ph: wordObj.ph || '', lv: wordObj.level || '',
            bk: bankId || '', ft: now, lt: now, n: 0, ok: 0, bad: 0 };
      log[wordObj.w] = e;
    }
    e.n++;
    if (right) e.ok++; else e.bad++;
    e.lt = now;
    if (!e.bk && bankId) e.bk = bankId;
    if (!e.m && wordObj.m) { e.m = wordObj.m; e.ph = wordObj.ph || ''; e.lv = wordObj.level || ''; }
    saveLog(log);
    return e;
  }

  // 旧版本只有 vh_learned，迁移一条骨架记录，报告里不至于丢失历史掌握词
  function migrateLog() {
    if (lsGet('log_mig', 0)) return;
    var log = wordLog(), m = learnedMap(), added = 0;
    Object.keys(m).forEach(function (w) {
      if (!log[w]) {
        log[w] = { w: w, m: '', ph: '', lv: '', bk: '', ft: 0, lt: 0, n: m[w], ok: m[w], bad: 0 };
        added++;
      }
    });
    if (added) saveLog(log);
    lsSet('log_mig', 1);
  }

  /* ---------- 每日统计（vh_daily） ---------- */
  function dailyMap() { return lsGet('daily', {}); }

  function saveDaily(d) {
    var keys = Object.keys(d).sort();
    while (keys.length > DAILY_CAP) delete d[keys.shift()];
    lsSet('daily', d);
  }

  // f: { neu 新学词, seen 答题数, ok, bad, games 局数, sec 学习秒数 }
  function dayBump(field, n) {
    var d = dailyMap(), t = todayStr();
    var e = d[t] || { neu: 0, seen: 0, ok: 0, bad: 0, games: 0, sec: 0 };
    e[field] = (e[field] || 0) + (n || 1);
    d[t] = e;
    saveDaily(d);
    return e;
  }

  function dayStat(day) { return dailyMap()[day] || { neu: 0, seen: 0, ok: 0, bad: 0, games: 0, sec: 0 }; }

  /* ---------- 统一答题入口：掌握度 + 单词日志 + 当日统计 ---------- */
  function record(wordObj, bankId, right) {
    if (!wordObj || !wordObj.w) return;
    var isNew = !wordLog()[wordObj.w];
    markLearned(wordObj.w, right);
    var e = logAnswer(wordObj, bankId, right);
    if (isNew) dayBump('neu');
    dayBump('seen');
    dayBump(right ? 'ok' : 'bad');
    return e;
  }

  function recordGame() { dayBump('games'); }
  function recordSession(seconds) { if (seconds > 0) dayBump('sec', Math.min(3600, Math.round(seconds))); }

  /* ---------- 学习报告数据 ---------- */
  function statusOf(entry, mastery) {
    if (mastery >= 3) return 'solid';
    if (mastery >= 2) return 'mastered';
    if (entry.bad >= 2 || (mastery >= 1 && entry.bad >= 1)) return 'weak';
    if (mastery >= 1) return 'learning';
    return 'fresh';
  }
  var STATUS_TEXT = { solid: '掌握牢固', mastered: '已掌握', learning: '熟悉中', weak: '待巩固', fresh: '初学' };

  function entries() {
    var log = wordLog(), m = learnedMap();
    return Object.keys(log).map(function (k) {
      var e = log[k];
      e.sc = m[e.w] || 0;
      e.st = statusOf(e, e.sc);
      return e;
    });
  }

  function lastDays(n) {
    var out = [], d = new Date();
    d.setDate(d.getDate() - n + 1);
    for (var i = 0; i < n; i++) { out.push(dayKey(d)); d.setDate(d.getDate() + 1); }
    return out;
  }

  function reportData() {
    migrateLog();
    var all = entries();
    var bankMap = {}, levels = {}, buckets = { solid: 0, mastered: 0, learning: 0, weak: 0, fresh: 0 };
    all.forEach(function (e) {
      buckets[e.st]++;
      var id = e.bk || 'unknown';
      if (!bankMap[id]) {
        var b = e.bk ? getBank(e.bk) : null;
        bankMap[id] = { id: id, name: b ? b.name : '已删除词库', icon: b ? (b.icon || '📚') : '🗂',
                        total: b ? b.words.length : 0, touched: 0, mastered: 0, bad: 0 };
      }
      var bk = bankMap[id];
      bk.touched++;
      if (e.sc >= 2) bk.mastered++;
      bk.bad += e.bad;
      if (e.lv) levels[e.lv] = (levels[e.lv] || 0) + 1;
    });

    var trend = lastDays(14).map(function (d) {
      var s = dayStat(d);
      return { day: d, label: d.slice(5).replace('-', '/'), neu: s.neu, seen: s.seen, sec: s.sec || 0,
               acc: s.seen ? Math.round(s.ok / s.seen * 100) : 0, games: s.games };
    });
    var today = dayStat(todayStr());
    var week = lastDays(7).reduce(function (a, d) {
      var s = dayStat(d);
      a.neu += s.neu; a.seen += s.seen; a.ok += s.ok; a.bad += s.bad; a.games += s.games; a.sec += s.sec || 0;
      return a;
    }, { neu: 0, seen: 0, ok: 0, bad: 0, games: 0, sec: 0 });

    var byError = all.slice().sort(function (a, b) { return (b.bad - a.bad) || (b.lt - a.lt); });
    var byRecent = all.slice().sort(function (a, b) { return b.lt - a.lt; });

    return {
      summary: {
        touched: all.length,
        mastered: buckets.solid + buckets.mastered,
        learning: buckets.learning + buckets.fresh,
        weak: buckets.weak,
        activeDays: Object.keys(dailyMap()).length,
        streak: streak(),
        bestShooter: best('best_shooter', 0),
        bestListen: best('best_listen', 0)
      },
      today: { neu: today.neu, seen: today.seen, games: today.games, sec: today.sec || 0,
               acc: today.seen ? Math.round(today.ok / today.seen * 100) : 0 },
      week: { neu: week.neu, seen: week.seen, games: week.games, sec: week.sec,
              acc: week.seen ? Math.round(week.ok / week.seen * 100) : 0 },
      buckets: [
        { key: 'solid', name: STATUS_TEXT.solid, n: buckets.solid, cls: 'b-solid' },
        { key: 'mastered', name: STATUS_TEXT.mastered, n: buckets.mastered, cls: 'b-mastered' },
        { key: 'learning', name: STATUS_TEXT.learning, n: buckets.learning, cls: 'b-learning' },
        { key: 'weak', name: STATUS_TEXT.weak, n: buckets.weak, cls: 'b-weak' },
        { key: 'fresh', name: STATUS_TEXT.fresh, n: buckets.fresh, cls: 'b-fresh' }
      ],
      banks: Object.keys(bankMap).map(function (k) {
        var b = bankMap[k];
        b.rate = b.total ? Math.round(b.mastered / b.total * 100) : 0;
        return b;
      }).sort(function (a, b) { return b.touched - a.touched; }),
      levels: Object.keys(levels).map(function (k) { return { key: k, n: levels[k] }; }),
      trend: trend,
      hardest: byError.filter(function (e) { return e.bad > 0; }).slice(0, 10),
      recent: byRecent.slice(0, 20),
      words: byRecent,
      dots: recentDots(14),
      statusText: STATUS_TEXT
    };
  }

  function exportCsv() {
    var rows = [['word', 'phonetic', 'meaning', 'bank', 'level', 'status', 'seen', 'right', 'wrong', 'first', 'last']];
    entries().sort(function (a, b) { return b.lt - a.lt; }).forEach(function (e) {
      rows.push([e.w, e.ph, e.m, e.bk, e.lv, STATUS_TEXT[e.st], e.n, e.ok, e.bad,
                 e.ft ? new Date(e.ft).toLocaleDateString('zh-CN') : '',
                 e.lt ? new Date(e.lt).toLocaleDateString('zh-CN') : '']);
    });
    return rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
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
  function speak(word, times) {
    if (!('speechSynthesis' in window)) return false;
    var n = times || 1;
    var vs = speechSynthesis.getVoices();
    var pref = null;
    if (voicesReady || vs.length) {
      pref = vs.find(function (v) { return /^en(-|_)?US/i.test(v.lang) && /female|zira|samantha/i.test(v.name); })
        || vs.find(function (v) { return /^en/i.test(v.lang); });
    }
    function make() {
      var u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.9;
      if (pref) u.voice = pref;
      return u;
    }
    speechSynthesis.cancel();
    setTimeout(function () {
      if (speechSynthesis.paused) speechSynthesis.resume();
      // 同一个 utterance 对象不能重复入队，每遍都要新建
      for (var i = 0; i < n; i++) speechSynthesis.speak(make());
    }, 50);
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
    record: record, recordGame: recordGame, recordSession: recordSession,
    wordLog: wordLog, dayStat: dayStat, reportData: reportData, exportCsv: exportCsv,
    mistakes: mistakes, addMistake: addMistake, removeMistake: removeMistake, clearMistakes: clearMistakes,
    checkin: checkin, streak: streak, checkedToday: checkedToday, recentDots: recentDots,
    best: best, get: get, set: lsSet, bump: bump,
    achList: achList, checkAchievements: checkAchievements,
    speak: speak, sfx: sfx,
    resetAll: function () {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k); });
    }
  };

  window.Store = api;
})();
