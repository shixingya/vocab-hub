# vocab-hub｜词汇中心

[![在线体验](https://img.shields.io/badge/▶_在线体验-GitHub_Pages-ff8a5c?style=for-the-badge)](https://shixingya.github.io/vocab-hub/)
[![release](https://img.shields.io/github/v/release/shixingya/vocab-hub?color=blueviolet&label=version)](https://github.com/shixingya/vocab-hub/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![零依赖](https://img.shields.io/badge/依赖-0%E4%B8%AA-34c36c)](#tech-stack)
[![词库](https://img.shields.io/badge/内置词库-7套·万级词量-a06bff)](data)
[![玩法](https://img.shields.io/badge/互动玩法-22种-ff8a5c)](#-游戏玩法22-种)

> 🎮 Game-based vocabulary learning web app | 游戏化网页背单词工具

线上体验 线上地址：https://shixingya.github.io/vocab-hub/ 

vocab-hub 是一个静态网页背单词项目，以游戏化方式记忆单词，**词库与代码解耦**。

✅ 内置 7 套分级词库：小学 / 初中 / 高中 / 托业 / 考研 / 托福 / 雅思（均易·中·难分级，源自开源词典 [ECDICT](https://github.com/skywind3000/ECDICT) + 手工精选）
✅ **22 种互动玩法**：单词射击、听音挑战 + 20 种答题/拼写/配对/动作/记忆小游戏，任选词库 × 玩法组合练习
✅ 支持用户导入自定义词库（JSON 文件或粘贴文本）
✅ 纯前端零依赖：无框架、无构建工具、无后端、无广告
✅ 双击即用：词库内联打包，任何设备双击 `index.html` 即可离线运行，无需服务器/部署

## ✨ 核心玩法

| 模式 | 玩法 | 设计要点 |
|---|---|---|
| 🔫 单词射击 | 中文释义提示 → 点击发射子弹击落对应单词飞机 | 连击阶梯加分（+10~+30）、3 条 ❤️、扫掠碰撞判定、出题即 TTS 朗读单词 |
| 🎧 听音挑战 | 听单词发音 → 四选一选释义 | Web Speech API 发音，无 TTS 环境自动降级为"看词选义"，答对复播加深音形联结 |

**温和学习理念**：不倒计时施压、飞机飘过不判死、中途退出可回首页，错题自动归入错题本复盘。

## 🕹️ 游戏玩法（22 种）

除特色玩法外，新增 20 种“边玩边记”小游戏，均由 `js/engine.js` 的通用引擎（会话/计分/连击/掌握度/错题）驱动，共用一套结果页：

| 类别 | 玩法 |
|---|---|
| 🔫🎧 特色 | 单词射击、听音挑战 |
| 📖 选择题族 | 看词选义、看义选词、听音选义、听音选词、首字母猜词、对错判断、限时抢答、火眼金睛（选正确拼写） |
| ✏️ 拼写族 | 字母拼词（乱序重组）、补全单词、单词默写（键盘输入） |
| 🔗 配对棋盘 | 连连看、记忆翻牌、对对碰（相邻消除）、两列连线、极速配对（限时） |
| 🐹 动作类 | 打地鼠、泡泡消消 |
| 🧠 记忆类 | 记忆序列、单词归位 |

## 📊 学习功能

- 🔥 打卡激励：完成一局即打卡，连续天数 + 最近 7 天亮点图
- 📈 学习数据：连续打卡 / 已掌握词数 / 射击最高分 / 听力最高连对
- 🧠 掌握度模型：答对 +1、答错 -2，同一词答对 2 次计入"已掌握"
- 📕 错题本：跨词库累计，按错误次数排序，可逐词播放发音、点击移除
- 🏅 成就系统：8 枚成就（初次启程 / 七日之约 / 十连斩 / 神枪手 / 顺风耳…）达成实时弹窗
- 📥 自定义词库导入：JSON / `word, 释义` 文本双格式，可删除

## 📚 词库扩展

内置词库数据以内联方式打包在 `js/data.js`（`window.VHBANKS`），使应用可在 `file://` 双击直接运行、无需服务器。新增/修改一套词库三步：

1. 在 `data/` 放一个词库 JSON（格式参考 [data/toeic.json](data/toeic.json)）：

```json
{
  "id": "cet4",
  "name": "四六级高频词",
  "icon": "📚",
  "desc": "CET4/6 核心词汇",
  "words": [
    { "w": "abandon", "ph": "/əˈbændən/", "m": "v. 放弃", "level": "easy" }
  ]
}
```

2. 在 `js/store.js` 顶部的注册表加一行 id，并在 `tools/build_datajs.py` 的 `ORDER` 列表补上同名 id：

```js
var BUILTIN_BANKS = [
  { id: 'toeic' },
  { id: 'cet4' }   // ← 新增
];
```

3. 重新生成内联数据文件（游戏代码零改动）：

```bash
python tools/build_datajs.py   # 由 data/*.json 重新打包出 js/data.js
```

## 🚀 快速开始

**双击即用，离线可运行**：直接双击 `index.html`（或右键 → 用浏览器打开）即可，任何设备、无需部署、无需服务器、无需安装任何东西。词库已内联进 `js/data.js`，不再有 `fetch` 跨域限制。

也可用任意 HTTP 服务器（如在线部署）：

```bash
python -m http.server 8890
# 浏览器访问 http://localhost:8890/
```

部署到 GitHub Pages：仓库 Settings → Pages → 选 `main` 分支根目录即可。

## 📁 目录结构

```
vocab-hub/
├── index.html          # 单页应用（首页/通用游戏页/结果页等多个区块）
├── css/style.css       # 温和糖果风 UI
├── js/
│   ├── data.js         # 【自动生成】内联 7 套词库(window.VHBANKS)，供 file:// 双击运行
│   ├── store.js        # 数据层：词库装载/掌握度/错题/打卡/成就/TTS/音效
│   ├── engine.js       # 通用游戏引擎 GameKit：会话/计分/连击/选择题引擎/退出清理
│   ├── games_quiz.js   # 玩法 1-11：选择题族 + 拼写族
│   ├── games_board.js  # 玩法 12-20：配对棋盘/动作/记忆类
│   ├── shooter.js      # 单词射击（Canvas 游戏）
│   ├── listen.js       # 听音挑战
│   └── app.js          # 主控：词库/玩法网格/统计/导入/成就检测
├── tools/
│   └── build_datajs.py # 由 data/*.json 打包生成 js/data.js
└── data/
    ├── primary.json    # 小学 / 初中 / 高中（词表 ∩ ECDICT）
    ├── junior.json  senior.json  toeic.json
    └── kaoyan.json  toefl.json  ielts.json   # 各词库均为 w/ph/m/level 结构（data.js 的可维护源）
```

## 🛠️ Tech Stack

原生 HTML + CSS + JavaScript，无任何第三方依赖。

| 能力 | 实现 |
|---|---|
| 发音 | Web Speech API（`speechSynthesis`，优先 en-US 女声） |
| 音效 | Web Audio API 振荡器轻量合成（射击/命中/错误/胜利/成就） |
| 游戏渲染 | Canvas 2D（DPR 适配、扫掠碰撞、粒子爆炸特效） |
| 持久化 | localStorage，统一 `vh_` 前缀，数据仅存本机 |

## ⚠️ 已知限制

- iOS Safari 首次发音需用户手势触发（点大喇叭即可）；无 TTS 环境自动降级为看词选义
- 自定义词库超过 localStorage 容量（约 5MB）时导入会静默失败，建议单库 ≤ 5000 词
- 浏览器自动播放策略可能拦截"出题即朗读"，属正常现象，玩家可手动点播放

## 📖 License

MIT
