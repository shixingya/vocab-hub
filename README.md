# vocab-hub｜词汇中心

[![在线体验](https://img.shields.io/badge/▶_在线体验-GitHub_Pages-ff8a5c?style=for-the-badge)](https://shixingya.github.io/vocab-hub/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![零依赖](https://img.shields.io/badge/依赖-0%E4%B8%AA-34c36c)](#tech-stack)
[![词库](https://img.shields.io/badge/内置托业词-3000%E8%AF%8D-a06bff)](data/toeic.json)

> 🎮 Game-based vocabulary learning web app | 游戏化网页背单词工具

vocab-hub 是一个静态网页背单词项目，以游戏化方式记忆单词，**词库与代码解耦**。

✅ 首发内置：托业高频词库（3000 词，易/中/难三级分级）
✅ 后续支持：雅思 / 托福 / 四六级 等词汇库扩展
✅ 支持用户导入自定义词库（JSON 文件或粘贴文本）
✅ 纯前端零依赖：无框架、无构建工具、无后端、无广告

## ✨ 核心玩法

| 模式 | 玩法 | 设计要点 |
|---|---|---|
| 🔫 单词射击 | 中文释义提示 → 点击发射子弹击落对应单词飞机 | 连击阶梯加分（+10~+30）、3 条 ❤️、扫掠碰撞判定、出题即 TTS 朗读单词 |
| 🎧 听音挑战 | 听单词发音 → 四选一选释义 | Web Speech API 发音，无 TTS 环境自动降级为"看词选义"，答对复播加深音形联结 |

**温和学习理念**：不倒计时施压、飞机飘过不判死、中途退出可回首页，错题自动归入错题本复盘。

## 📊 学习功能

- 🔥 打卡激励：完成一局即打卡，连续天数 + 最近 7 天亮点图
- 📈 学习数据：连续打卡 / 已掌握词数 / 射击最高分 / 听力最高连对
- 🧠 掌握度模型：答对 +1、答错 -2，同一词答对 2 次计入"已掌握"
- 📕 错题本：跨词库累计，按错误次数排序，可逐词播放发音、点击移除
- 🏅 成就系统：8 枚成就（初次启程 / 七日之约 / 十连斩 / 神枪手 / 顺风耳…）达成实时弹窗
- 📥 自定义词库导入：JSON / `word, 释义` 文本双格式，可删除

## 📚 词库扩展（代码零改动）

新增一套词库只需两步：

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

2. 在 `js/store.js` 顶部的注册表加一行：

```js
var BUILTIN_BANKS = [
  { id: 'toeic', url: 'data/toeic.json' },
  { id: 'cet4',  url: 'data/cet4.json' }   // ← 新增
];
```

## 🚀 快速开始

纯静态站点，直接用任意 HTTP 服务器打开（`file://` 下 fetch 受跨域限制）：

```bash
python -m http.server 8890
# 浏览器访问 http://localhost:8890/
```

部署到 GitHub Pages：仓库 Settings → Pages → 选 `main` 分支根目录即可。

## 📁 目录结构

```
vocab-hub/
├── index.html          # 单页应用（7 个页面区块）
├── css/style.css       # 温和糖果风 UI
├── js/
│   ├── store.js        # 数据层：词库加载/掌握度/错题/打卡/成就/TTS/音效
│   ├── shooter.js      # 单词射击（Canvas 游戏）
│   ├── listen.js       # 听音挑战
│   └── app.js          # 主控：导航/渲染/导入/成就检测
└── data/
    └── toeic.json      # 托业高频词库（3000 词，源自 ECDICT 高频商务词 + 手工精选）
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
