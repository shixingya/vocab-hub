/* ============ 听音挑战模式：听发音选释义，10 题制 ============ */
(function () {
  'use strict';

  var TOTAL = 10;
  var L = null;
  var Store = null;

  function $(id) { return document.getElementById(id); }

  function start(words, bankId) {
    L = {
      queue: words.slice(0, TOTAL), qi: 0,
      streak: 0, bestStreak: 0, correct: 0,
      wrongWords: [], answered: false, bankId: bankId
    };
    $('ln-round').textContent = '1';
    $('ln-streak').textContent = '0';
    nextQuestion();
  }

  function nextQuestion() {
    if (L.qi >= L.queue.length) return end();
    var cur = L.queue[L.qi];
    L.cur = cur;
    L.answered = false;

    $('ln-round').textContent = L.qi + 1;
    $('ln-feedback').textContent = '';
    $('ln-tip').textContent = '🎧 点击喇叭听发音，选出正确意思';

    // 选项 = 正确释义 + 3 个干扰释义
    var bank = Store.getBank(bankId());
    var wrongs = Store.shuffle(bank.words.filter(function (w) {
      return w.w !== cur.w && w.m !== cur.m;
    })).slice(0, 3);
    var opts = Store.shuffle([cur].concat(wrongs));

    var box = $('ln-options');
    box.innerHTML = '';
    opts.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'ln-opt';
      b.textContent = o.m;
      b.onclick = function () { answer(b, o, cur); };
      box.appendChild(b);
    });

    // 自动播放一次（部分浏览器需用户手势，兜底：点大喇叭播放）
    setTimeout(function () { play(); }, 350);
  }

  function bankId() { return L.bankId; }

  function play() {
    if (!L || !L.cur) return;
    var btn = $('ln-play');
    btn.classList.remove('pulse');
    void btn.offsetWidth; // 重启动画
    btn.classList.add('pulse');
    var ok = Store.speak(L.cur.w);
    if (!ok) {
      // 无 TTS 环境降级：直接显示单词，变成看词选义
      $('ln-tip').innerHTML = '<span class="ln-word-tip">' + L.cur.w + '</span>';
    }
  }

  function answer(btn, chosen, cur) {
    if (L.answered) return;
    L.answered = true;

    var opts = $('ln-options').querySelectorAll('.ln-opt');
    opts.forEach(function (b) { b.disabled = true; });

    var right = chosen.m === cur.m;
    var fb = $('ln-feedback');

    if (right) {
      btn.classList.add('correct');
      L.streak++;
      L.bestStreak = Math.max(L.bestStreak, L.streak);
      L.correct++;
      $('ln-streak').textContent = L.streak;
      Store.sfx.good();
      fb.innerHTML = '✅ 答对啦！<b>' + cur.w + '</b> ' + (cur.ph || '');
    } else {
      btn.classList.add('wrong');
      // 高亮正确项
      opts.forEach(function (b) { if (b.textContent === cur.m) b.classList.add('correct'); });
      L.streak = 0;
      $('ln-streak').textContent = '0';
      Store.sfx.bad();
      Store.addMistake(cur);
      L.wrongWords.push(cur);
      fb.innerHTML = '💡 正确答案：<b>' + cur.w + '</b> ' + (cur.ph || '');
    }
    Store.markLearned(cur.w, right);

    // 复播一遍正确发音，加深记忆
    setTimeout(function () { Store.speak(cur.w); }, 400);
    setTimeout(function () {
      if (!L) return;
      L.qi++;
      nextQuestion();
    }, 1800);
  }

  function end() {
    var bestStreakAll = Store.best('best_listen', L.bestStreak);
    var allRight = L.correct === L.queue.length;
    Store.bump('games');
    var stat = { correct: L.correct, total: L.queue.length, bestStreak: L.bestStreak };
    var wrong = L.wrongWords.slice();
    L = null;
    window.VHApp.onGameEnd({ mode: 'listen', bestListen: bestStreakAll, allRight: allRight });
    window.VHApp.showResult({
      mode: 'listen',
      emoji: allRight ? '🎧' : (stat.correct >= 6 ? '😊' : '🌱'),
      title: allRight ? '满分顺风耳！' : (stat.correct >= 6 ? '不错哦！' : '慢慢来，比较快～'),
      sub: '答对 ' + stat.correct + '/' + stat.total + ' 题，最高连对 ' + stat.bestStreak,
      stats: [
        { n: stat.correct, l: '答对' },
        { n: stat.bestStreak, l: '最高连对' },
        { n: bestStreakAll, l: '历史纪录' }
      ],
      wrongWords: wrong
    });
  }

  window.VHListen = {
    boot: function (store) { Store = store; },
    start: start,
    stop: function () { L = null; },
    play: play,
    running: function () { return !!L; }
  };
})();
