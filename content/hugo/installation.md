+++
title = "Hugo 安装与站点初始化"
date = 2026-11-15T09:05:00+08:00
draft = false
author = ""
keywords = ["hugo", "install", "安装", "站点初始化", "目录结构", "部署"]
summary = "详细介绍 Hugo 在各平台的安装方式、版本要求、站点目录结构、hugo.toml 配置、本地开发、构建与部署。"
tags = ["hugo", "installation"]
+++

# Hugo 安装与站点初始化

本文介绍 Hugo 的安装、站点初始化、目录结构、配置、本地开发、构建与部署，是 [总览]({{< ref "/post/hugo-guide" >}}) 中「安装与环境」模块的完整展开。

<!--more-->

---

## 一、安装 Hugo

### 1.1 版本要求

- 官方建议使用最新的**扩展版（extended）**。扩展版额外支持 SCSS/Sass 的实时编译，很多主题（含 github-style）会用到，因此构建 CI 应使用 `hugomods/hugo:exts` 这类带扩展的镜像。
- 本项目（github-style 主题）要求最低 Hugo `0.41`，实际建议使用 `0.100` 以上的新版本以获得 Goldmark 的完整特性与更好的兼容性。
- 可通过 `hugo version` 查看版本，输出形如 `hugo v0.1xx.x-xxxxxxxxx+extended linux/amd64`。

### 1.2 Linux

使用各发行版的包管理器，或直接下载官方二进制：

```bash
# Debian / Ubuntu（注意：发行版仓库的版本可能偏旧）
sudo apt update && sudo apt install hugo

# 若需要扩展版/最新版，推荐下载官方二进制（以 amd64 为例）
curl -sL https://github.com/gohugoio/hugo/releases/latest/download/hugo_extended_0.118.2_linux-amd64.deb -o hugo.deb
sudo dpkg -i hugo.deb
```

> 也可以到 [Hugo Releases](https://github.com/gohugoio/hugo/releases) 下载对应的 `hugo_extended_*_linux-*.tar.gz`，解压后把 `hugo` 可执行文件放入 `$PATH`（如 `/usr/local/bin/`）。

### 1.3 macOS

```bash
# 使用 Homebrew
brew install hugo
```

### 1.4 Windows

```bash
# 使用 Chocolatey
choco install hugo-extended

# 或使用 Scoop
scoop install hugo-extended
```

也可以直接下载 Windows 的 `.zip` 二进制并加入环境变量。

### 1.5 使用 Go 安装

若已安装 Go 工具链，可用 `go install` 安装（需要 `CGO_ENABLED=1` 才能获得扩展版）：

```bash
go install github.com/gohugoio/hugo@latest
```

### 1.6 验证安装

```bash
hugo version
hugo help
```

`hugo help` 会列出 `new`、`new site`、`server`、`config`、`gen`、`deploy` 等子命令。

---

## 二、初始化站点

### 2.1 创建新站点

```bash
hugo new site mysite
cd mysite
```

`hugo new site` 会生成如下目录结构（空目录可能不会全部生成）：

```text
mysite/
├── archetypes/     # 内容模板（Front Matter 默认值）
├── assets/         # 需被 Hugo Pipes 处理的源资源（SCSS/JS/图片）
├── content/        # 站点内容（Markdown 为主）
├── data/           # 数据文件（JSON/YAML/TOML），供模板调用
├── i18n/           # 多语言翻译文件
├── layouts/        # 站点级模板（可覆盖主题）
├── static/         # 原样拷贝的静态资源（图片、css、js、favicon 等）
├── themes/         # 主题（子模块或目录）
└── hugo.toml       # 站点配置（旧版名为 config.toml）
```

各目录职责：

| 目录 | 职责 |
| --- | --- |
| `archetypes/` | 定义 `hugo new` 创建内容时的默认 Front Matter 模板 |
| `assets/` | 存放希望被 Hugo Pipes 处理（编译/压缩/指纹）的资源，模板中用 `resources.Get` 引用 |
| `content/` | 站点内容源，Hugo 据此生成页面 |
| `data/` | 结构化数据文件，模板中用 `site.Data.*` 访问 |
| `i18n/` | 多语言翻译字符串 |
| `layouts/` | **站点级模板，优先级高于主题**，可用于覆盖主题布局 |
| `static/` | 原样复制到 `public/` 的静态文件，不经过处理 |
| `themes/` | 主题存放位置 |
| `hugo.toml` | 主配置文件 |

### 2.2 初始化 Git 仓库

```bash
git init
echo "public/" > .gitignore   # public/ 是构建产物，不应提交
```

> 关于 `public/` 的说明：`public/` 是运行 `hugo` 后的输出目录，应加入 `.gitignore`。CI 会在 Job 中重新生成并作为 artifacts 上传，无需提交到仓库。

---

## 三、配置（hugo.toml）

### 3.1 基础配置

```toml
baseURL = "https://example.com/"   # 站点根地址（部署时必须正确设置）
languageCode = "zh-cn"             # 语言代码
title = "我的站点"                  # 站点标题
theme = "github-style"             # 启用主题
```

关键配置项：

| 配置 | 说明 |
| --- | --- |
| `baseURL` | 站点部署后的根 URL。本地开发可为 `/`，CI 部署时用 `--baseURL` 覆盖 |
| `languageCode` | 站点主语言（如 `zh-cn`、`en`） |
| `title` | 站点标题 |
| `theme` | 启用的主题名（对应 `themes/<name>`） |
| `paginate` | 列表页每页文章数，默认 `10` |
| `summaryLength` | 自动摘要的字数，默认 `70` |
| `enableEmoji` | 是否启用 Emoji 渲染，默认 `false` |
| `pygmentsCodeFences` | 代码围栏是否语法高亮（旧版），新版由 Goldmark 接管 |
| `pygmentsUseClasses` | 高亮是否使用 CSS 类而非内联样式 |

### 3.2 分区配置

Hugo 的配置支持按环境（development/production）与按输出类型（output）分组：

```toml
[params]
  author = "zhaohu"
  description = "个人博客"

[outputs]
  home = ["html", "json"]          # 首页额外输出 JSON（供搜索）

[outputFormats.json]
  mediaType = "application/json"
  baseName = "index"
  isPlainText = false
```

`[params]` 下是站点级参数，供模板通过 `site.Params.*` 访问。github-style 主题的大量配置都位于 `[params]` 下，详见 [github-style 主题]({{< ref "github-style" >}})。

### 3.3 多配置文件

Hugo 支持将配置拆分为 `hugo.toml` 下的 `config/` 目录（`config/_default/`、`config/production/` 等）或按环境使用 `hugo --environment production`。简单站点使用单个 `hugo.toml` 即可。

---

## 四、创建内容

```bash
hugo new post/my-first-post.md
```

- 该命令会基于 `archetypes/default.md` 生成带 Front Matter 的新文件。
- 默认生成的 `draft = true`（草稿），本地预览与正式构建默认都**不输出草稿**；将 `draft` 改为 `false` 才会发布。
- 指定 Section 即指定 `hugo new <section>/<file>.md`，如 `hugo new docs/install.md`。

Front Matter 的完整写法见 [Hugo 专有 Markdown 与 Shortcodes]({{< ref "hugo-markdown" >}})。

---

## 五、本地开发

### 5.1 启动开发服务器

```bash
hugo server
```

- 默认监听 `http://localhost:1313/`。
- 支持**热重载（LiveReload）**：修改内容/模板/样式后浏览器自动刷新。

常用参数：

```bash
hugo server -D                 # 包含草稿（--buildDrafts）
hugo server --bind 0.0.0.0     # 允许局域网访问
hugo server --port 8080        # 指定端口
hugo server --disableFastRender # 关闭快速渲染（排查缓存问题时）
```

### 5.2 快速排查

- 页面不更新：确认是否因缓存，可加 `--disableFastRender` 或重启。
- 草稿不显示：确认 `draft` 是否为 `false`，或加 `-D`。
- 主题不生效：确认 `hugo.toml` 中 `theme` 拼写与 `themes/<name>` 目录一致。

---

## 六、构建

### 6.1 生成静态站点

```bash
hugo                  # 构建到 public/
hugo --minify         # 同时压缩 HTML/CSS/JS
hugo -b "https://..." # 用 --baseURL 覆盖配置中的 baseURL
hugo -e production    # 指定环境
```

- 构建产物默认输出到 `public/`。
- 部署前通常先清空 `public/` 再构建，避免残留旧文件：`rm -rf public && hugo`。

### 6.2 输出格式

通过 `[outputs]` 控制每个页面类型输出的格式。默认 `home` 输出 HTML 与 RSS，`page` 输出 HTML。github-style 的本地搜索需要 `home` 额外输出 `json`（见 [github-style 主题]({{< ref "github-style" >}})）。

---

## 七、部署

静态站点可部署到任意静态托管。常见方式：

### 7.1 GitLab Pages（本项目采用）

本项目通过 `.gitlab-ci.yml` 在 CI 中自动构建并部署（详见仓库的 `.gitlab-ci.yml`）。核心思路：

```yaml
image: hugomods/hugo:exts          # 使用含扩展的 Hugo 镜像

pages:
  script:
    - hugo --minify --baseURL "${CI_PAGES_URL}"
  artifacts:
    paths:
      - public                      # 上传构建产物
```

CI 中 `--baseURL "${CI_PAGES_URL}"` 会覆盖本地占位的 `baseURL = "/"`，保证绝对链接正确。

### 7.2 GitHub Pages

可借助 GitHub Actions 构建后发布到 `gh-pages` 分支，或在本地构建后推送 `public/` 目录。

### 7.3 Netlify / Vercel

二者均内置 Hugo 支持：指定构建命令 `hugo --minify`、发布目录 `public` 即可，推送即自动部署。

### 7.4 自有服务器 / Nginx

本地 `hugo --minify` 构建后，将 `public/` 上传到服务器，用 Nginx 指向该目录并配置 `try_files` 即可。

---

## 八、常见问题

| 问题 | 解决 |
| --- | --- |
| 构建报错 `Failed to render pages` | 检查模板与短代码语法，运行 `hugo --verbose` 看详细日志 |
| 样式缺失 | 确认主题已正确安装到 `themes/`，且 `theme` 配置正确 |
| 图片不显示 | 静态资源应放 `static/` 并用 `{{ "path" | absURL }}` 引用，或用页面资源 |
| 链接 404 | 确认 `baseURL` 与部署路径一致，尤其是部署在子路径时 |

---

下一步可阅读 [github-style 主题]({{< ref "github-style" >}}) 了解本项目的主题引入与页面格式。
