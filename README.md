# 赵虎的个人技术主页

基于 [Minimal Mistakes](https://github.com/mmistakes/minimal-mistakes) Jekyll 主题，托管在 GitHub Pages 上。

## 这个站有什么

- **首页**：作者介绍 + 最新博客文章
- **项目页**（/projects/）：自动从 GitHub 拉取项目仓库，按技术方向分类展示
- **博客**（/posts/）：技术笔记
- **关于**（/about/）：个人介绍

## 项目页是怎么工作的（重点）

项目页**不需要手动维护**。

数据来自仓库里的快照文件 `assets/data/repos.json`，由 GitHub Actions 工作流（`.github/workflows/update-repos.yml`）每天自动重新生成一次并提交。打开页面时先读快照立刻渲染，再在后台调一次 GitHub API 实时校准，让刚建的仓库立刻出现。

所以流程是：

1. 在 GitHub 上新建一个项目仓库，正常写代码。
2. 给这个仓库打上 topic 标签（仓库首页 → 右侧 About 区域 → 齿轮图标 → Topics）。
3. 回到网站的项目页刷新，项目就自动出现在对应分类里了。

第 3 步如果没看到新项目，多半是浏览器还没拿到实时数据，等几秒刷新即可；如果当天 Actions 还没跑，也可以去仓库的 Actions 标签页手动触发一次「更新项目页快照」，立刻生效。

### 为什么还要存一份快照

浏览器直接调 GitHub API 有两个绕不开的限制：未认证时每小时只有 60 次额度，而且是按 IP 算，多人共用一个出口网络（公司网、校园网）很快见底；部分网络环境下 `api.github.com` 也不稳定。这两种情况一旦发生，页面就会静默停在旧数据上，新仓库永远不出现，而且不会有任何报错。

所以额外存一份快照兜底。快照由 Actions 生成，Actions 跑在 GitHub 自己的服务器上，内网直连 API，额度 5000 次/小时，不受上面两个限制。

### 手动刷新快照

本地装了 Node，在仓库根目录执行：

```bash
node scripts/update-repos.mjs
```

担心限流可以带上令牌：`GITHUB_TOKEN=xxx node scripts/update-repos.mjs`

### 分类标签对照表

打这些英文 topic，项目就会归入对应分类：

| 分类 | 打哪个 topic 标签 |
|------|------------------|
| 云原生存储 | `csi`、`storage`、`kubernetes-storage`、`ceph`、`rook`、`snapshot`、`cloud-native-storage` 等 |
| 平台工程 / DevOps | `devops`、`ci-cd`、`platform-engineering`、`infrastructure`、`jenkins`、`gitlab`、`terraform`、`docker`、`kubernetes`、`operator`、`automation` 等 |
| 学习与工具 | `learning`、`tool`、`notes`、`demo` 等 |

没打任何匹配标签的项目，会归到「其他」分类。另外，fork 的仓库通常没打标签，脚本会根据仓库名称和描述里的关键词自动归类（比如含 zfs、ceph 的归到云原生存储，含 jenkins、gitlab、svn 的归到平台工程）。标签规则和关键词都定义在 `assets/js/projects.js` 文件顶部的 `CATEGORIES` 数组里，想改可以改那里。

## 怎么发一篇新博客

在 `_posts/` 目录新建一个文件，文件名格式：`年-月-日-标题.md`，例如 `2022-09-07-nfs-v4.md`。文件开头按下面格式写：

```markdown
---
title: "文章标题"
date: 2026-08-10
categories:
  - notes
tags:
  - 存储
---

正文写在这里。
```

保存后推送到 GitHub，网站会自动构建并显示这篇文章。

## 怎么更新网站（两种方式任选）

### 方式一：用 GitHub 网页直接改（最简单，适合改小地方）

1. 打开个人项目仓库。
2. 点进要改的文件，点右上角的铅笔图标编辑，改完点绿色 Commit 按钮。
3. 等一两分钟，网站自动更新。

### 方式二：用 GitHub Desktop 本地改（适合批量改、加文章）

1. 电脑装 [GitHub Desktop](https://desktop.github.com/)。
2. 用 `File → Clone repository` 把这个仓库拉到本地。
3. 本地改文件，改完在 GitHub Desktop 里提交并 Push。
4. 等一两分钟，网站自动更新。

## 常见问题

**改了没生效？** GitHub Pages 构建需要一两分钟，稍等刷新即可。也可以在仓库的 `Actions` 标签页看构建进度。

**想换头像？** 把一张自己的照片命名为 `bio-photo.jpg`，放到 `assets/images/` 目录下，然后在 `_config.yml` 里把 `avatar` 那行的注释去掉（删掉行首的 `#`）。

**想改站点名称、简介？** 都在 `_config.yml` 文件里，对应 `title`、`description`、`author` 这几个字段。
