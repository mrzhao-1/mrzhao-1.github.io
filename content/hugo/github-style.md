+++
title = "github-style 主题详解"
date = 2026-11-15T09:10:00+08:00
draft = false
author = ""
keywords = ["hugo", "github-style", "主题", "博客", "theme"]
summary = "详细介绍 hugo github-style 主题的引入、页面结构、页面格式、功能、组件，以及主题专有的 Markdown 与格式。"
tags = ["hugo", "github-style", "theme"]
+++

# github-style 主题详解

`github-style` 是一款基于 Hugo 的博客主题，它最大程度地还原了 GitHub 用户主页（Profile）的视觉与交互体验。本文是该主题的完整文档，覆盖主题引入、页面格式、功能、组件，以及**主题专有的 Markdown 与格式**。

> 本文是 [总览]({{< ref "/post/hugo-guide" >}}) 中「主题引入」模块的展开；主题在总览中只做整体介绍，具体内容以本文为准。

<!--more-->

---

## 第一章 主题概述

### 1.1 主题是什么

`github-style` 是一个由 [MeiK](https://github.com/MeiK2333) 开发的 Hugo 主题，其核心设计目标是**把博客做成 GitHub 用户主页的样子**。当你打开使用该主题搭建的站点时，会看到一个高度还原 GitHub 的界面：顶部的黑色导航栏、左侧的用户头像与个人简介卡片、中间的 `README` 卡片、仓库（文章）列表、以及底部标志性的**贡献日历图（Contributions Graph）**。

### 1.2 基本信息

| 项目 | 说明 |
| --- | --- |
| 主题名称 | Github Style |
| 作者 | MeiK（[MeiK2333](https://github.com/MeiK2333)） |
| 许可证 | MIT |
| 源码仓库 | `github.com/MeiK2333/github-style` |
| 演示站点 | <https://meik2333.com/> |
| 最低 Hugo 版本 | `0.41` |
| 标签 | `blog`、`google analytics` |
| 内置特性 | Google Analytics 支持 |

### 1.3 设计理念

该主题的页面布局完全对标 GitHub 的经典 Profile 页：

- **用户资料卡**（左侧）：头像、昵称、用户名、个人简介、所在地、邮箱、网址，以及一排社交图标（GitHub、Twitter、Facebook、LinkedIn、Instagram、Tumblr、Stack Overflow、Bluesky、RSS 等）。
- **导航 Tab**（Overview / Posts）：对应 GitHub 仓库主页的 `Overview` 与 `Repositories` 两个标签页，并带计数角标。
- **README 卡片**：像 GitHub 仓库首页一样，把 `content/readme.md` 渲染成一个 `README.md` 展示框。
- **置顶仓库**：通过 `pin: true` 把文章像「置顶仓库」一样固定展示。
- **贡献日历图**：根据文章发布时间渲染出 GitHub 风格的日历热力图，支持按年份切换。
- **文章动态时间线**：按月汇总文章，像 GitHub 的 Contribution activity 一样展示。

### 1.4 安装方式

主题以 Git 子模块（submodule）的方式安装：

```bash
# 初始化 Hugo 站点
hugo new site mysite
cd mysite

# 以子模块方式安装主题
git submodule add git@github.com:MeiK2333/github-style.git themes/github-style
```

> 注意：某些较新版本的仓库会把 `content/posts` 重命名为 `content/post`。如果升级主题后列表页不显示文章，请执行：
>
> ```bash
> mv content/posts content/post
> ```

更新主题：

```bash
cd themes/github-style
git pull
```

启用主题（在 `hugo.toml` 中）：

```toml
theme = "github-style"
```

### 1.5 主题目录结构

```text
themes/github-style/
├── archetypes/
│   └── default.md          # 新文章的默认 Front Matter 模板
├── config.template.toml    # 完整配置参考模板
├── layouts/
│   ├── 404.html            # 404 页面
│   ├── index.html          # 首页入口
│   ├── _default/
│   │   ├── baseof.html     # 全局布局骨架
│   │   ├── single.html     # 文章详情页
│   │   ├── list.html       # 列表页
│   │   └── index.json      # 搜索索引输出
│   ├── partials/           # 可复用组件（见第四章）
│   └── shortcodes/
│       └── details.html    # 折叠块短代码
├── static/
│   ├── css/                # 样式（含深色/浅色/语法高亮/TOC）
│   ├── js/                 # 脚本（主题模式/贡献图/搜索/TOC）
│   └── images/             # 头像、社交图标等静态资源
├── theme.toml              # 主题元信息
└── LICENSE
```

---

## 第二章 页面格式详解

本章逐一说明主题支持的每一种「页面」的格式与写法，所有示例均按主题实际支持的格式给出。

### 2.1 内容目录结构

主题约定以下内容组织方式：

```text
content/
├── readme.md               # 首页 README 卡片内容（渲染在 Overview 顶部）
└── post/                   # 文章 Section（务必使用单数 post）
    ├── post-a.md
    ├── post-b.md
    └── ...
```

- `content/readme.md`：会被渲染成首页的 `README.md` 展示框，相当于 GitHub 仓库首页的 README。
- `content/post/`：所有文章放在 `post` 目录下，文章会出现在 `Posts` 列表页与贡献日历图中。

> 注：本站的「Hugo 使用与开发指南」系列文档放在 `content/hugo/` 下，属于独立 Section，不会被主题首页的文章列表与贡献日历图统计，但可通过 `/hugo/` 路径直接访问。

创建 README：

```bash
hugo new readme.md
echo '`Hello World!`' > content/readme.md
```

创建新文章：

```bash
hugo new post/title_of_the_post.md
```

> Hugo 默认以 `draft: true` 创建文章，需将 `draft` 改为 `false` 才会发布到站点。

### 2.2 Front Matter 格式

主题的 `archetypes/default.md` 定义了默认的文章头信息：

```toml
+++
title = ""
date = {{ .Date }}
author = ""
keywords = ["", ""]
cover = ""
summary = ""
+++
```

一篇完整文章的 Front Matter 示例：

```toml
+++
title = "我的第一篇文章"
date = 2026-11-15T08:46:47+08:00
draft = false
author = "zhaohu"
keywords = ["hugo", "github-style", "theme"]
cover = "https://example.com/cover.png"
summary = "这是文章的摘要，会显示在列表页与 SEO 描述中。"
tags = ["hugo", "blog"]
pin = true
math = true
mathJax = false
+++
```

各字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 文章标题 |
| `date` | datetime | 发布日期，参与贡献日历图统计 |
| `draft` | bool | 是否草稿，`true` 时不发布 |
| `author` | string | 文章作者，用于 `twitter:creator` 等 SEO 元数据 |
| `keywords` | []string | 文章关键词，覆盖站点级 `params.keywords` |
| `cover` | string | 封面图 URL，用于 Open Graph / Twitter Card |
| `summary` | string | 摘要，显示在列表页与搜索结果中，不会出现在正文 |
| `tags` | []string | 标签，用于标签分类与筛选 |
| `pin` | bool | 是否置顶（显示在首页「Pinned」区块） |
| `math` | bool | 是否启用 KaTeX 数学公式渲染 |
| `mathJax` | bool | 是否启用 MathJax 数学公式渲染 |

### 2.3 首页（Home / Overview）格式

首页由 `layouts/index.html` 定义，渲染 `partials/home.html`，最终结构为：

```text
┌─────────────────────────────────────────────┐
│ Header（导航栏 + 搜索框 + 主题切换）          │
├──────────────┬──────────────────────────────┤
│ 用户资料卡    │  Overview 标签页              │
│ (avatar/bio/ │  ├─ README.md 卡片           │
│  社交图标)   │  ├─ Pinned / Popular posts    │
│              │  ├─ 贡献日历图                │
│              │  └─ Post activity 时间线      │
└──────────────┴──────────────────────────────┘
│ Footer                                       │
└──────────────────────────────────────────────┘
```

**README 卡片**通过 `content/readme.md` 提供内容，例如：

````markdown
# Hello World!

这是我的博客主页，欢迎 👋

- 🚀 记录技术与生活
- 📝 使用 [github-style](https://github.com/MeiK2333/github-style) 主题构建
````

**置顶文章**：若存在 `pin: true` 的文章，Overview 会显示「Pinned」区块（最多 6 篇）；否则退化为「Popular posts」，展示 `post` Section 下的最新文章。

### 2.4 文章列表页（Posts / List）格式

列表页由 `layouts/_default/list.html` 定义，结构为：用户资料卡 + 文章列表（含分页与标签筛选）。

- 访问 `/post/` 时，顶部显示标签列表，下面按时间倒序列出所有文章，每篇文章展示标题、摘要、标签与创建时间。
- 访问某个标签页（如 `/tags/hugo/`）时，顶部显示「N results for hugo」及「Clear filter」清除按钮。
- 分页通过 Hugo 的 `.Paginator` 实现，底部显示 `Previous` / `Next` 按钮。

### 2.5 文章详情页（Single）格式

详情页由 `layouts/_default/single.html` 定义，渲染 `partials/post.html`，采用 GitHub Gist / 文件的「页眉」样式：

```text
┌───────────────────────────────────────────────┐
│ author / 标题          Created · Modified     │
│ ┌─────────────────────────────────────────┐   │
│ │ ☰(TOC)  123 Words   #tag1 #tag2         │   │
│ ├─────────────────────────────────────────┤   │
│ │                                         │   │
│ │             正文内容                      │   │
│ │                                         │   │
│ └─────────────────────────────────────────┘   │
│ Gitalk 评论区（可选）                          │
└───────────────────────────────────────────────┘
```

- 页眉显示 `作者 / 文章标题`，下方为 `Created`（发布时间）与 `Modified`（最后修改时间，需启用 `lastmod`）。
- 文件头工具栏提供 TOC 目录按钮、字数统计（`{{ countwords .Content }} Words`）与标签。
- 正文包裹在 `.markdown-body` 容器中，使用 GitHub 风格的 Markdown 样式渲染。

### 2.6 404 页面格式

`layouts/404.html` 复刻了 GitHub 的 404 页面：黑色背景、巨大的 `404` 数字与「Didn't find anything here!」文案，中间嵌入会动的 Octocat 灯泡 SVG 动画。

### 2.7 搜索索引 JSON 格式

启用本地搜索后，主题会额外输出一个 `index.json`（由 `layouts/_default/index.json` 生成），供前端 `fuse.js` 检索。每条记录包含：

```json
{
  "objectID": "文件唯一ID",
  "date": 1763189007,
  "publishdate": "2026-11-15T08:46:47Z",
  "lastmod": 1763189007,
  "lang": "zh-cn",
  "permalink": "https://example.com/post/xxx/",
  "relpermalink": "/post/xxx/",
  "title": "文章标题",
  "summary": "摘要",
  "content": "正文纯文本（截断到 5000 字符）",
  "authors": ["zhaohu"],
  "kind": "page",
  "type": "post",
  "section": "post",
  "tags": ["hugo"],
  "categories": null
}
```

> 草稿（`draft: true`）、私有页（`private: true`）与 `searchable: false` 的页面不会被索引；`readme.md` 也会被排除。

---

## 第三章 功能详解

本章列出主题的全部功能，并说明每种功能的作用与启用方式。

### 3.1 GitHub 风格用户主页

还原 GitHub Profile 页的左侧用户资料卡，展示头像、昵称、用户名、个人简介、所在地、邮箱、网址，以及「Organizations」区块的一排社交/组织图标。

相关配置：

```toml
[params]
  author = "zhaohu"
  description = "你的个人描述"
  location = "China"
  email = "you@example.com"
  url = "https://example.com"
  avatar = "/images/avatar.png"
  userStatusEmoji = "😀"
```

### 3.2 深色 / 浅色主题切换

通过 `theme-mode.js` 实现 GitHub 风格的主题切换。点击导航栏的月亮图标或 Overview 页的颜色模式开关即可在深/浅色间切换。

- 通过 `data-color-mode` 属性切换样式，偏好保存在 `localStorage`。
- 首次访问遵循系统的 `prefers-color-scheme` 设置。
- 切换函数为 `switchTheme()`，主题由 `light.css` / `dark.css` 两套样式控制。

### 3.3 贡献日历图（Contributions Graph）

`github-style.js` 根据文章发布时间，把文章绘制成 GitHub 风格的贡献日历热力图：

- 支持按年份切换（右侧年份列表）。
- 每个格子代表一天，颜色深浅表示当天发布文章数量（0–4+ 档）。
- 鼠标悬停显示「N posts on 日期」提示。
- 顶部显示「N posts in the last year」统计。

### 3.4 文章动态时间线（Post activity）

与贡献日历图配套，按月份分组展示文章动态，每一组可折叠，标题形如「Created 3 posts」，展开后列出当月文章的标题与日期。

### 3.5 置顶文章（Pinned）

在 Front Matter 中设置 `pin: true`，文章会像「置顶仓库」一样固定在首页 Overview 顶部。

```toml
+++
title = "置顶文章"
pin = true
+++
```

### 3.6 README 展示

`content/readme.md` 的内容会渲染为首页的 `README.md` 展示框，支持完整的 Markdown 语法（标题、列表、代码块、图片、链接等）。

### 3.7 本地搜索（fuse.js）

主题内置基于 [Fuse.js](https://fusejs.io/) 的本地全文搜索，无需后端。启用后导航栏搜索框会直接检索 `index.json`。

启用方式：

```toml
[params]
  enableSearch = true

[outputs]
  home = ["html", "json"]

[outputFormats.json]
  mediaType = "application/json"
  baseName = "index"
  isPlainText = false
```

### 3.8 Google 搜索兜底

未启用本地搜索时，搜索框会退化为 Google 站点搜索，以 `site:<baseURL>` 限定范围跳转到 Google。

### 3.9 RSS 订阅

设置 `rss = true` 后，左侧资料卡的 Organizations 区块会显示 RSS 图标，链接指向站点的 `index.xml`。

```toml
[params]
  rss = true
```

### 3.10 Gitalk 评论

通过 [Gitalk](https://github.com/gitalk/gitalk)（基于 GitHub Issues 的评论系统）为文章提供评论区。Gitalk 与 Vssue 的完整对比见 [评论组件（Gitalk vs Vssue）]({{< ref "comments" >}})。

```toml
[params]
  enableGitalk = true

  [params.gitalk]
    clientID = "Your client ID"
    clientSecret = "Your client secret"
    repo = "你的博客仓库名"
    owner = "你的 GitHub 用户名"
    admin = "你的 GitHub 用户名"
    id = "location.pathname"
    labels = "gitalk"
    perPage = 15
    pagerDirection = "last"
    createIssueManually = true
    distractionFreeMode = false
    proxy = "https://cors-anywhere.azm.workers.dev/https://github.com/login/oauth/access_token"
```

各子项说明：

| 子项 | 说明 |
| --- | --- |
| `clientID` / `clientSecret` | GitHub OAuth App 的凭证 |
| `repo` | 用于存放评论 Issue 的仓库名 |
| `owner` / `admin` | 仓库所有者 / 管理员 GitHub ID |
| `id` | 评论 Issue 的唯一标识，默认 `location.pathname`（页面路径） |
| `labels` | Issue 标签 |
| `perPage` | 分页大小（最大 100） |
| `pagerDirection` | 评论排序方向，`last` 或 `first` |
| `createIssueManually` | 是否自动创建 Issue（`true` 管理员登录自动创建） |
| `distractionFreeMode` | 无干扰模式，支持 `Cmd/Ctrl + Enter` 提交 |
| `proxy` | 可选的 OAuth 反向代理 |

### 3.11 LaTeX 数学公式（KaTeX）

在 Front Matter 中设置 `math: true`，主题会通过 CDN 引入 KaTeX 并自动渲染分隔符包裹的公式。

### 3.12 MathJax 数学公式

主题同样支持 MathJax，设置 `mathJax: true` 启用。

### 3.13 折叠块（details 短代码）

主题内置 `details` 短代码，用于创建可折叠的内容块（语法详见 [第五章](#第五章-github-style-专有-markdown-与格式)）。

### 3.14 摘要与摘要分隔符

主题提供两种控制列表页展示内容的方式：`summary` 与 `<!--more-->`（详见 [第五章](#第五章-github-style-专有-markdown-与格式)）。

### 3.15 最后修改时间（lastmod）

在 `config.toml` 中启用后，详情页会显示 `Modified` 时间。

```toml
lastmod = true

[frontmatter]
  lastmod = ["lastmod", ":fileModTime", ":default"]
```

### 3.16 自定义 CSS / JS

将自定义样式与脚本放入 `static` 目录，再通过参数引入：

```toml
[params]
  custom_css = ["css/custom.css"]
  custom_js = ["js/custom.js"]
  # 带 defer 属性的自定义脚本
  defer_custom_js = ["js/defer_custom.js"]
```

### 3.17 Google Analytics

通过 Hugo 内置的 `services` 配置接入 Google Analytics：

```toml
[services]
  [services.googleAnalytics]
    ID = "UA-123456-789"
```

### 3.18 SEO 与社交分享元数据

`extended_head.html` 为页面注入完整 SEO 元数据：

- `description`、`keywords`、`robots`、`canonical`
- Twitter Card（`twitter:card`、`twitter:title`、`twitter:description`、`twitter:image` 等）
- Open Graph（`og:type`、`og:title`、`og:image`、`article:published_time` 等）
- RSS / JSON Feed 的 `alternate` 链接

### 3.19 相对时间显示

`github-style.js` 中的 `setRelativeTime()` 会把 `<relative-time>` 标签渲染为「5 minutes ago」「3 days ago」这类相对时间，超过一年则显示具体日期。

### 3.20 文章目录（TOC）

详情页文件头工具栏的列表图标按钮可展开目录。`toc.js` 会扫描正文中的 `h1`–`h6` 标题，按标题级别缩进生成可点击跳转的目录。

### 3.21 标签（Tags）

Front Matter 中的 `tags` 会自动生成标签分类页（`/tags/<tag>/`），列表页与详情页均可通过标签跳转与筛选。

```toml
+++
tags = ["hugo", "github-style", "theme"]
+++
```

### 3.22 分页（Pagination）

列表页使用 Hugo 的 `.Paginator` 进行分页，可通过 Hugo 的 `paginate` 配置调整每页文章数量（默认每页 10 篇）。

```toml
paginate = 10
```

### 3.23 移动端响应式

主题对移动端做了适配：导航栏折叠为汉堡菜单，桌面端的 Tab 导航在移动端切换为 `mobile-menus.html` 的简化导航，用户资料卡与内容区纵向堆叠。

---

## 第四章 组件详解

本章列出主题的每一个组件（partial / 模板 / 短代码），说明其职责与关键逻辑。

### 4.1 `layouts/_default/baseof.html`（全局骨架）

所有页面的基础布局，定义 HTML 骨架与组件的装配顺序：

```text
head → header → search → content(block) → footer → script
```

### 4.2 `partials/head.html`（头部）

负责 `<head>` 内的元数据与资源引入：

- `charset`、`viewport`、`title`、`theme-color`
- 依次引入样式：`frameworks.min.css`、`github.min.css`、`github-style.css`、`light.css`、`dark.css`、`syntax.css`
- 引入 `theme-mode.js`（需在渲染前加载，避免闪烁）
- 处理 `favicon`、自定义 CSS/JS（含 `defer_custom_js`）
- 引入 `extended_head.html`

### 4.3 `partials/extended_head.html`（SEO 元数据）

注入 description、keywords、canonical、robots、Twitter Card、Open Graph、RSS/JSON Feed 等 SEO 与分享相关元数据。

### 4.4 `partials/header.html`（顶部导航栏）

还原 GitHub 的黑色 Header：

- 左侧站点 Logo（`headerIcon`）
- 中间搜索框（本地搜索或 Google 搜索兜底）
- 右侧主题切换月亮图标（`switchTheme()`）
- 移动端汉堡菜单按钮，用于展开/收起搜索框

### 4.5 `partials/menus.html` / `partials/mobile-menus.html`（导航 Tab）

- `menus.html`：桌面端 `UnderlineNav` 导航，包含 `Overview`（首页）与 `Posts`（文章列表）两个标签，`Posts` 带文章数 `Counter` 角标。
- `mobile-menus.html`：移动端简化导航，作用与桌面端一致。

### 4.6 `partials/user-profile.html`（用户资料卡）

渲染左侧用户信息卡片，包括：

- 头像（`avatar`）与状态 Emoji（`userStatusEmoji`）
- 昵称（`author`）与用户名（`github`）
- 个人简介（`description`）
- 所在地（`location`）、邮箱（`email`）、网址（`url`）
- Organizations 区块的社交图标：GitHub、Twitter、Facebook、LinkedIn、Instagram、Tumblr、Stack Overflow、Bluesky、自定义链接（`params.links`）与 RSS

### 4.7 `partials/overview.html`（首页内容区）

首页核心内容，包含：

- README 卡片（读取 `content/readme.md`）
- Pinned / Popular posts（置顶或最新文章，最多 6 篇，展示标题、摘要、标签）
- 贡献日历图（`#contributions` 容器，注入文章 JSON 数据）
- Post activity 时间线（`#posts-activity` 容器）

### 4.8 `partials/post.html`（文章详情）

渲染单篇文章，采用 GitHub Gist/文件页眉样式：

- 作者 / 标题、Created / Modified 时间
- TOC 目录按钮、字数统计、标签
- `.markdown-body` 正文容器
- 引入 `toc.js` 与 `toc.css`

### 4.9 `partials/posts.html`（文章列表）

渲染文章列表页：

- 标签筛选结果统计（`N results for <tag>`）与 `Clear filter`
- 标签云（调用 `tags.html`）
- 文章条目（标题、摘要、标签、创建时间）
- 分页按钮（`Previous` / `Next`）

### 4.10 `partials/tags.html`（标签云）

遍历 `site.Taxonomies` 输出所有标签（与分类），每个标签带对应的 Octicon 图标与跳转链接。

### 4.11 `partials/gitalk.html`（评论组件）

当 `enableGitalk = true` 时，在文章底部渲染 Gitalk 评论区，实例化 Gitalk 并调用 `render()`。

### 4.12 `partials/search.html`（搜索容器）

提供一个隐藏的 `#search-result` 容器，供 `search.js` 在用户提交搜索后填充结果。

### 4.13 `partials/footer.html`（页脚）

渲染页脚，包含站点版权（`site.Copyright`）或「Theme by github-style」说明，以及 GitHub 商标声明。

### 4.14 `partials/script.html`（脚本装配）

负责在页面底部统一引入脚本：

- `github-style.js`（贡献日历图、相对时间、折叠交互）
- KaTeX（当 `math: true`）或 MathJax（当 `mathJax: true`）
- Fuse.js 与 `search.js`（当 `enableSearch: true`）

### 4.15 `layouts/shortcodes/details.html`（折叠块短代码）

实现 {{</* details "标题" */>}} ... {{</* /details */>}} 折叠块，内部使用 `markdownify` 渲染 Markdown 内容。

---

## 第五章 github-style 专有 Markdown 与格式

本章集中说明**主题专有的**、在写作时会用到的 Markdown 语法与格式约定。通用 Markdown 语法见 [通用 Markdown 语法]({{< ref "markdown" >}})，Hugo 通用的专有语法（Front Matter、内置 Shortcodes、高亮等）见 [Hugo 专有 Markdown 与 Shortcodes]({{< ref "hugo-markdown" >}})。以下示例均**用其自身的格式来展示其格式**。

### 5.1 折叠块（`details` 短代码）

主题内置 `details` 短代码，用于创建可折叠的内容块。写法如下：

```text
{{</* details "摘要标题" */>}}

这里是要折叠的内容，支持 **Markdown**、列表、代码等。

{{</* /details */>}}
```

渲染效果等价于：

```html
<details>
  <summary>摘要标题</summary>
  <p>这里是要折叠的内容，支持 <strong>Markdown</strong>、列表、代码等。</p>
</details>
```

> 注意：{{</* details "标题" */>}} 与 {{</* /details */>}} 必须成对出现，且中间内容用空行分隔更稳妥。详情页 TOC 的展开按钮就是利用了类似的 `<summary>/<details>` 交互。

### 5.2 摘要控制

主题提供两种控制「列表页摘要」的方式，二者可叠加：

**方式一：`summary` 字段**（仅用于列表页与 SEO，不进入正文）：

```toml
+++
summary = "这是摘要内容，只会显示在列表页，不会出现在正文里。"
+++
```

**方式二：`<!--more-->` 分隔符**（分隔符之前的内容同时进入列表页摘要与正文）：

```text
这段文字会同时出现在列表页摘要和正文中。

<!--more-->

这段文字只会出现在正文中，列表页摘要到此为止。
```

### 5.3 置顶文章（`pin`）

在 Front Matter 中设置 `pin: true`，文章会像「置顶仓库」一样固定在首页 Overview 顶部（最多显示 6 篇）：

```toml
+++
title = "这是一篇置顶文章"
pin = true
+++
```

### 5.4 数学公式（KaTeX / MathJax）

**KaTeX**：在 Front Matter 中设置 `math = true` 启用。

```toml
+++
math = true
+++
```

行内公式使用 `\( ... \)`，块级公式使用 `$$ ... $$`：

```text
行内公式 \( E = mc^2 \)

块级公式：

$$ \sum_{i=1}^{n} i = \frac{n(n+1)}{2} $$
```

**MathJax**：设置 `mathJax = true` 启用，支持 `$ ... $` / `\( ... \)` 行内公式与 `$$ ... $$` 块级公式。

```toml
+++
mathJax = true
+++
```

> 说明：官方 README 中写的是 `katex: math`，但主题实际读取的是 `params.math`，因此正确写法为 `math: true`。

### 5.5 README 卡片

首页的 `README` 卡片内容来自 `content/readme.md`，支持完整 Markdown，例如：

````markdown
# Hello World!

这是我的博客主页，欢迎 👋

- 🚀 记录技术与生活
- 📝 使用 [github-style](https://github.com/MeiK2333/github-style) 主题构建

```bash
echo "hello"
```
````

### 5.6 标签（`tags`）

在 Front Matter 中用数组声明标签，主题会自动生成标签页并支持筛选：

```toml
+++
tags = ["hugo", "github-style", "theme"]
+++
```

### 5.7 关键词（`keywords`）与封面（`cover`）

```toml
+++
keywords = ["hugo", "主题", "博客"]
cover = "https://example.com/cover.png"
+++
```

- `keywords` 覆盖站点级关键词，用于 SEO。
- `cover` 是文章封面图 URL，用于 Open Graph / Twitter Card 分享卡片。

### 5.8 主题专有格式速查表

| 格式 | 写法 | 作用 |
| --- | --- | --- |
| 折叠块 | {{</* details "标题" */>}} ... {{</* /details */>}} | 可折叠内容块 |
| 摘要字段 | `summary = "..."` | 仅列表页摘要 |
| 摘要分隔符 | `<!--more-->` | 分割摘要与正文 |
| 置顶 | `pin = true` | 首页置顶 |
| KaTeX | `math = true` + `\(...\)` / `$$...$$` | 数学公式 |
| MathJax | `mathJax = true` | 数学公式 |
| 标签 | `tags = ["a", "b"]` | 标签分类 |
| 封面 | `cover = "url"` | 分享卡片封面 |

---

## 第六章 完整配置参考

以下是整合了所有功能的 `hugo.toml` 参考模板：

```toml
baseURL = "https://example.com/"
languageCode = "zh-cn"
title = "我的个人空间"
theme = "github-style"
pygmentsCodeFences = true
pygmentsUseClasses = true
paginate = 10

[params]
  author = "你的名字"
  description = "你的个人描述"
  github = "你的GitHub用户名"
  twitter = "你的Twitter用户名"
  facebook = "你的Facebook用户名"
  linkedin = "你的LinkedIn用户名"
  instagram = "你的Instagram用户名"
  tumblr = "你的Tumblr用户名"
  stackoverflow = "你的StackOverflow用户ID"
  bluesky = "你的Bluesky用户名"
  email = "you@example.com"
  url = "https://example.com"
  keywords = "blog, hugo, github-style"
  rss = true
  lastmod = true
  favicon = "/images/github-mark.png"
  avatar = "/images/avatar.png"
  headerIcon = "/images/github-mark-white.png"
  location = "China"
  userStatusEmoji = "😀"
  enableGitalk = true
  enableSearch = true
  custom_css = ["css/custom.css"]
  custom_js = ["js/custom.js"]
  defer_custom_js = ["js/defer_custom.js"]

  [params.gitalk]
    clientID = "Your client ID"
    clientSecret = "Your client secret"
    repo = "你的博客仓库名"
    owner = "你的GitHub用户名"
    admin = "你的GitHub用户名"
    id = "location.pathname"
    labels = "gitalk"
    perPage = 15
    pagerDirection = "last"
    createIssueManually = true
    distractionFreeMode = false
    proxy = ""

  [[params.links]]
    title = "Link"
    href = "https://github.com/your-name"
  [[params.links]]
    title = "Link2"
    href = "https://example.com"
    icon = "https://example.com/images/avatar.png"

[outputs]
  home = ["html", "json"]

[outputFormats.json]
  mediaType = "application/json"
  baseName = "index"
  isPlainText = false

[frontmatter]
  lastmod = ["lastmod", ":fileModTime", ":default"]

[services]
  [services.googleAnalytics]
    ID = "UA-123456-789"
```

---

## 结语

`github-style` 是一款「颜值即正义」的 Hugo 主题，用 GitHub 的经典视觉语言承载你的博客。掌握本文所述的页面格式、功能、组件与主题专有 Markdown 后，你既可以开箱即用地搭建一个仿 GitHub 的个人博客，也能通过 `custom_css` / `custom_js` 与局部模板（partial）进行深度定制。

回到 [总览]({{< ref "/post/hugo-guide" >}}) 查看完整文档导航。
