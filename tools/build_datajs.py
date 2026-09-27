#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 data/*.json 内联为 js/data.js（window.VHBANKS），供 file:// 双击直接运行。
运行时不再 fetch 本地 JSON（浏览器在 file:// 下禁止 fetch 本地文件）。

用法：
    python tools/build_datajs.py
    # 修改/新增 data/*.json 后重新运行即可刷新 js/data.js
"""
import json
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "js", "data.js")

# 内置词库顺序（与 store.js 的 BUILTIN_BANKS 保持一致）
ORDER = ["primary", "junior", "senior", "toeic", "kaoyan", "toefl", "ielts"]


def main():
    banks = {}
    for bid in ORDER:
        path = os.path.join(DATA, bid + ".json")
        if not os.path.exists(path):
            print("跳过（不存在）:", path)
            continue
        with io.open(path, encoding="utf-8") as f:
            banks[bid] = json.load(f)

    # 紧凑输出，保证中文不转义（ensure_ascii=False）以减小体积并保持可读
    payload = json.dumps(banks, ensure_ascii=False, separators=(",", ":"))
    header = (
        "/* 自动生成，请勿手改：由 tools/build_datajs.py 从 data/*.json 内联生成。\n"
        "   window.VHBANKS 为内置词库数据，使应用可在 file:// 双击直接运行（无需服务器）。 */\n"
    )
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
        f.write("window.VHBANKS=")
        f.write(payload)
        f.write(";\n")

    total = sum(len(b.get("words", [])) for b in banks.values())
    size_kb = os.path.getsize(OUT) / 1024.0
    print("已生成 js/data.js：%d 套词库，共 %d 词，%.0f KB" % (len(banks), total, size_kb))


if __name__ == "__main__":
    main()
