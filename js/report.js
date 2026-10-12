/* ============ 学习报告：本地缓存的单词级记录 → 可视化报告 + 导出 ============ */
(function () {
  'use strict';

  var S = null;
  var view = { status: 'all', bank: 'all', q: '', sort: 'recent', limit: 40 };
  var cache = null;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts), t = new Date();
    var sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
    var y = new Date(); y.setDate(y.getDate() - 1);
    var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (sameDay(d, t)) return '今天 ' + hm;
    if (sameDay(d, y)) return '昨天 ' + hm;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function fmtMin(sec) {
    var m = Math.round((sec || 0) / 60);
    if (m < 60) return m + ' 分钟';
    return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
  }

  /* ---------- 顶部概览 ---------- */
  function renderSummary(r) {
    var box = $('rp-summary'); box.innerHTML = '';
    [
      { n: r.summary.touched, l: '📝 学过单词' },
      { n: r.summary.mastered, l: '✅ 已掌握' },
      { n: r.summary.weak, l: '🌱 待巩固' },
      { n: r.summary.streak, l: '🔥 连续打卡' }
    ].forEach(function (s) {
      var i = el('div', 'stat-item');
      i.appendChild(el('div', 'stat-num', String(s.n)));
      i.appendChild(el('div', 'stat-label', s.l));
      box.appendChild(i);
    });

    var line = $('rp-today');
    line.innerHTML = '';
    var parts = [
      '今天学新 ' + r.today.neu + ' 词',
      '答题 ' + r.today.seen + ' 次',
      '正确率 ' + (r.today.seen ? r.today.acc + '%' : '—'),
      '用时 ' + fmtMin(r.today.sec),
      '本周 ' + r.week.neu + ' 新词 / ' + r.week.games + ' 局'
    ];
    parts.forEach(function (p, i) {
      if (i) line.appendChild(el('span', 'rp-sep', '·'));
      line.appendChild(el('span', null, p));
    });
  }

  /* ---------- 近 14 天柱状图 ---------- */
  function renderTrend(r) {
    var box = $('rp-trend'); box.innerHTML = '';
    var max = Math.max.apply(null, r.trend.map(function (d) { return d.neu; }).concat([1]));
    r.trend.forEach(function (d, i) {
      var col = el('div', 'rp-col');
      var bar = el('div', 'rp-bar');
      bar.style.height = Math.max(3, Math.round(d.neu / max * 100)) + '%';
      if (d.neu === 0) bar.classList.add('empty');
      bar.title = d.label + ' 新学 ' + d.neu + ' 词 · 答题 ' + d.seen + ' 次 · 正确率 ' + (d.seen ? d.acc + '%' : '—');
      col.appendChild(bar);
      col.appendChild(el('div', 'rp-x', i % 2 === 1 ? d.label.slice(3) : ''));
      if (d.day === r.trend[r.trend.length - 1].day) col.classList.add('today');
      box.appendChild(col);
    });
    var peak = Math.max.apply(null, r.trend.map(function (d) { return d.neu; }));
    $('rp-trend-tip').textContent = peak > 0 ? '每天新学单词数 · 最高 ' + peak + ' 词' : '还没有学习数据，完成一局游戏后这里会出现每日新词趋势';
  }

  /* ---------- 掌握度分布 ---------- */
  function renderBuckets(r) {
    var box = $('rp-buckets'); box.innerHTML = '';
    var total = Math.max(1, r.summary.touched);
    r.buckets.forEach(function (b) {
      var row = el('div', 'rp-bar-row');
      row.appendChild(el('div', 'rp-bar-name', b.name));
      var track = el('div', 'rp-track');
      var fill = el('div', 'rp-fill ' + b.cls);
      fill.style.width = Math.round(b.n / total * 100) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', 'rp-bar-num', b.n + ' 词 · ' + Math.round(b.n / total * 100) + '%'));
      box.appendChild(row);
    });
  }

  /* ---------- 词库进度 ---------- */
  function renderBanks(r) {
    var box = $('rp-banks'); box.innerHTML = '';
    if (!r.banks.length) { box.appendChild(el('div', 'rp-none', '还没有学习记录，先去玩一局吧～')); return; }
    r.banks.forEach(function (b) {
      var row = el('div', 'rp-bank-row');
      row.appendChild(el('div', 'rp-bank-name', b.icon + ' ' + b.name));
      var track = el('div', 'rp-track');
      var fill = el('div', 'rp-fill b-mastered');
      fill.style.width = (b.total ? Math.round(b.mastered / b.total * 100) : 0) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', 'rp-bank-num', '掌握 ' + b.mastered + '/' + (b.total || '—') + ' · 学过 ' + b.touched));
      box.appendChild(row);
    });
  }

  /* ---------- 易错词 ---------- */
  function renderHardest(r) {
    var box = $('rp-hardest'); box.innerHTML = '';
    if (!r.hardest.length) { box.appendChild(el('div', 'rp-none', '还没有出过错，太稳了 👍')); return; }
    r.hardest.forEach(function (e) {
      var chip = el('div', 'rp-chip');
      chip.appendChild(el('span', 'rp-chip-w', e.w));
      chip.appendChild(el('span', 'rp-chip-n', '错 ' + e.bad + ' 次'));
      chip.title = (e.ph ? e.ph + ' ' : '') + (e.m || '');
      chip.onclick = function () { S.speak(e.w, 3); };
      box.appendChild(chip);
    });
  }

  /* ---------- 已学单词清单 ---------- */
  function filtered(r) {
    var q = view.q.trim().toLowerCase();
    var out = r.words.filter(function (e) {
      if (view.status !== 'all' && e.st !== view.status) return false;
      if (view.bank !== 'all' && (e.bk || 'unknown') !== view.bank) return false;
      if (q && e.w.toLowerCase().indexOf(q) < 0 && (e.m || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var cmp = {
      recent: function (a, b) { return b.lt - a.lt; },
      errors: function (a, b) { return (b.bad - a.bad) || (b.lt - a.lt); },
      alpha: function (a, b) { return a.w.localeCompare(b.w); }
    }[view.sort];
    return out.sort(cmp);
  }

  function renderWords(r) {
    var box = $('rp-words'); box.innerHTML = '';
    var list = filtered(r);
    $('rp-words-count').textContent = '共 ' + list.length + ' 词';
    if (!list.length) {
      box.appendChild(el('div', 'rp-none', r.summary.touched ? '没有符合条件的单词' : '还没有学习记录'));
      return;
    }
    list.slice(0, view.limit).forEach(function (e) {
      var row = el('div', 'rp-word');
      var head = el('div', 'rp-word-head');
      head.appendChild(el('div', 'rp-word-w', e.w));
      head.appendChild(el('div', 'rp-tag st-' + e.st, r.statusText[e.st]));
      var sp = el('button', 'rp-speak', '🔊');
      sp.title = '播放发音';
      sp.onclick = function () { S.speak(e.w, 3); };
      head.appendChild(sp);
      head.appendChild(el('div', 'rp-word-time', fmtDate(e.lt)));
      row.appendChild(head);
      if (e.m || e.ph) row.appendChild(el('div', 'rp-word-m', (e.ph ? e.ph + ' ' : '') + (e.m || '')));
      row.appendChild(el('div', 'rp-word-meta', '答题 ' + e.n + ' 次 · 对 ' + e.ok + ' / 错 ' + e.bad +
        (e.ft ? ' · 首学 ' + fmtDate(e.ft) : '')));
      box.appendChild(row);
    });
    if (list.length > view.limit) {
      var more = el('button', 'ghost-btn', '加载更多（还有 ' + (list.length - view.limit) + ' 词）');
      more.onclick = function () { view.limit += 60; renderWords(cache); };
      box.appendChild(more);
    }
  }

  function buildFilters(r) {
    var box = $('rp-filters'); box.innerHTML = '';
    var chips = [{ key: 'all', name: '全部' }].concat(r.buckets);
    chips.forEach(function (b) {
      var c = el('button', 'rp-chip-btn' + (view.status === b.key ? ' on' : ''), b.name);
      c.onclick = function () { view.status = b.key; view.limit = 40; buildFilters(r); renderWords(r); };
      box.appendChild(c);
    });

    var sel = el('select', 'rp-select');
    var opts = [{ id: 'all', name: '全部词库' }].concat(r.banks.map(function (b) { return { id: b.id, name: b.name }; }));
    opts.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.id; op.textContent = o.name;
      if (o.id === view.bank) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { view.bank = sel.value; view.limit = 40; renderWords(r); };
    box.appendChild(sel);

    var sort = el('select', 'rp-select');
    [{ id: 'recent', name: '最近学过' }, { id: 'errors', name: '错得最多' }, { id: 'alpha', name: '字母序' }]
      .forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.id; op.textContent = o.name;
        if (o.id === view.sort) op.selected = true;
        sort.appendChild(op);
      });
    sort.onchange = function () { view.sort = sort.value; renderWords(r); };
    box.appendChild(sort);
  }

  /* ---------- 报告文本（复制用） ---------- */
  function reportText(r) {
    var lv = {};
    r.levels.forEach(function (x) { lv[x.key] = x.n; });
    var lines = [
      'vocab-hub 学习报告 · ' + new Date().toLocaleString('zh-CN'),
      '累计学过 ' + r.summary.touched + ' 个单词，已掌握 ' + r.summary.mastered + ' 个，待巩固 ' + r.summary.weak + ' 个。',
      '今天新学 ' + r.today.neu + ' 词、答题 ' + r.today.seen + ' 次，正确率 ' + (r.today.seen ? r.today.acc + '%' : '—') + '，用时 ' + fmtMin(r.today.sec) + '。',
      '最近 7 天新学 ' + r.week.neu + ' 词，完成 ' + r.week.games + ' 局；连续打卡 ' + r.summary.streak + ' 天，累计学习 ' + r.summary.activeDays + ' 天。',
      '难度分布：' + ['easy', 'mid', 'hard'].map(function (k) {
        return { easy: '易', mid: '中', hard: '难' }[k] + ' ' + (lv[k] || 0) + ' 词';
      }).join('，') + '。'
    ];
    if (r.banks.length) {
      lines.push('词库进度：' + r.banks.slice(0, 4).map(function (b) {
        return b.name + ' 掌握 ' + b.mastered + (b.total ? '/' + b.total : '');
      }).join('；') + '。');
    }
    if (r.hardest.length) lines.push('最容易错的词：' + r.hardest.slice(0, 8).map(function (e) { return e.w; }).join('、') + '。');
    lines.push('射击最高分 ' + r.summary.bestShooter + '，听力最高连对 ' + r.summary.bestListen + '。');
    return lines.join('\n');
  }

  function copyText(txt, btn) {
    function done(ok) {
      var old = btn.textContent;
      btn.textContent = ok ? '✅ 已复制' : '⚠️ 复制失败，请手动选择';
      setTimeout(function () { btn.textContent = old; }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { fallback(txt, done); });
    } else fallback(txt, done);
  }
  function fallback(txt, done) {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { done(document.execCommand('copy')); } catch (e) { done(false); }
    document.body.removeChild(ta);
  }
  function downloadCsv() {
    var csv = '\ufeff' + S.exportCsv();
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'vocab-hub-学习记录-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- 入口 ---------- */
  function render() {
    if (!S) S = window.Store;
    cache = S.reportData();
    renderSummary(cache);
    renderTrend(cache);
    renderBuckets(cache);
    renderBanks(cache);
    renderHardest(cache);
    buildFilters(cache);
    renderWords(cache);
    $('rp-text').value = reportText(cache);
    $('rp-storage-tip').textContent =
      '记录保存在本机浏览器 localStorage（键：vh_log / vh_daily / vh_learned），共 ' + cache.summary.touched + ' 词、' + cache.summary.activeDays + ' 天，换设备或清除浏览器数据会丢失。';
  }

  function bind() {
    var se = $('rp-search');
    se.oninput = function () { view.q = se.value; view.limit = 40; renderWords(cache); };
    $('rp-copy').onclick = function () { copyText($('rp-text').value, $('rp-copy')); };
    $('rp-csv').onclick = downloadCsv;
  }

  window.VHReport = { boot: function (store) { S = store; bind(); }, render: render };
})();
