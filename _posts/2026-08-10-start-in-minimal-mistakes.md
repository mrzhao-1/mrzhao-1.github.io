---
layout: single
title: "Minimal Mistakes：从更好的主题开始"
date: 2026-08-10
categories:
  - notes
tags:
  - 随笔
---

本系列讲解从知名主题项目Minimal Mistakes开始创建知识库和经验博文。

本文档整理 Minimal Mistakes 主题中常用的 Markdown 语法、YAML Front Matter 参数、布局配置、特色功能与完整实例，便于查阅和复制。

## 可以移植的 Markdown 格式

如果希望内容跨平台，建议尽量使用标准 Markdown，避免依赖特定主题或静态站点生成器的专属语法。

详细的可移植的 Markdown 核心描述：[可移植的 Markdown 格式速查](/markdown/portable-markdown/)

如果希望跨平台，建议：

1. 正文使用标准 Markdown。

2. 主题专属功能单独维护。

3. 跨平台发布时，准备一份“通用 Markdown 版”。

## 平台相关的 Markdown 格式

看起来像 Markdown 的语法，不一定是标准 Markdown。

很多功能其实来自 Jekyll、Liquid、Kramdown 或 Minimal Mistakes 主题。

详细的平台相关的 非标准 Markdown描述：[不可移植的 Markdown 格式说明](/markdown/non-portable-markdown/)

## Minimal Mistakes / Jekyll 专属格式

这些功能只在 Jekyll + Minimal Mistakes 环境中完整生效。 

如果跨平台发布，需要改写或删除这些专属语法。

Minimal Mistakes / Jekyll 专属格式与配置：[关于minimal-mistakes主题专属格式](/markdown/minimal-mistakes-jekyll-specific/)

## 总结

平台相关的 Markdown 格式和 Minimal Mistakes / Jekyll 专属格式有一些互相包含的格式描述，主要原因是平台相关的 Markdown 格式大部分是来自 Minimal Mistakes / Jekyll 项目对 Markdown 格式的定制，可以相互对照。
