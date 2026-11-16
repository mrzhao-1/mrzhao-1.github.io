+++
title = "Hugo 专有 Markdown 与 Shortcodes"
date = 2026-11-15T09:20:00+08:00
draft = false
author = ""
keywords = ["hugo", "shortcodes", "front-matter", "highlight", "goldmark", "markdown"]
summary = "Hugo 独有的 Markdown 扩展与格式：Front Matter、Shortcodes（内置与自定义）、摘要分隔符、代码高亮、ref/relref 链接、页面资源与 Goldmark 配置。"
tags = ["hugo", "shortcodes", "markdown"]
+++

# Hugo 专有 Markdown 与 Shortcodes

本文介绍 **Hugo 专有**的 Markdown 扩展与格式，是 [总览]({{< ref "/post/hugo-guide" >}}) 中「Markdown 写作规范」的进阶篇。通用 Markdown 见 [通用 Markdown 语法]({{< ref "markdown" >}})，github-style 专有格式见 [github-style 主题]({{< ref "github-style" >}})。

<!--more-->

---

## 一、Front Matter

### 1.1 什么是 Front Matter

Front Matter 是内容文件**开头**的元数据块，用 `+++`（TOML）、`---`（YAML）或 `{ }`（JSON）包裹。Hugo 用它来确定标题、日期、标签、布局等。

三种格式示例：

**TOML**（用 `+++` 包裹）：

```toml
+++
title = "文章标题"
date = 2026-11-15T09:00:00+08:00
draft = false
tags = ["hugo", "blog"]
+++
```

**YAML**（用 `---` 包裹）：

```yaml
---
title: "文章标题"
date: 2026-11-15T09:00:00+08:00
draft: false
tags:
  - hugo
  - blog
---
```

**JSON**（用 `{ }` 包裹）：

```json
{
  "title": "文章标题",
  "date": "2026-11-15T09:00:00+08:00",
  "draft": false,
  "tags": ["hugo", "blog"]
}
```

> 本站（github-style 主题）默认使用 TOML 格式，即 `+++`。

### 1.2 常用字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 页面标题 |
| `date` | datetime | 发布时间 |
| `draft` | bool | 草稿，`true` 不发布 |
| `weight` | int | 排序权重，越小越靠前 |
| `slug` | string | 自定义 URL 尾段 |
| `url` | string | 完全自定义 URL |
| `tags` | []string | 标签（分类法） |
| `categories` | []string | 分类（分类法） |
| `summary` | string | 摘要 |
| `description` | string | SEO 描述 |
| `keywords` | []string | 关键词 |
| `author` | string | 作者 |
| `aliases` | []string | 旧 URL 重定向 |
| `layout` | string | 指定布局模板 |
| `type` | string | 内容类型 |
| `lastmod` | datetime | 最后修改时间 |

### 1.3 日期格式

Hugo 推荐使用带时区的 ISO 8601 格式：

```toml
+++
date = 2026-11-15T09:00:00+08:00
lastmod = 2026-11-15T18:00:00+08:00
+++
```

---

## 二、Shortcodes（短代码）

Shortcode 是 Hugo 最具特色的能力：**在 Markdown 中嵌入可复用的片段/组件**。调用语法用 {{</* ... */>}}（输出 HTML）或 {{%/* ... */%}}（内容先经过 Markdown 渲染）。

### 2.1 内置 Shortcode 概览

Hugo 内置了大量 Shortcode，常用如下：

| Shortcode | 用途 | 示例 |
| --- | --- | --- |
| `figure` | 带标题的图片 | {{</* figure src="/img.png" title="标题" */>}} |
| `gist` | 嵌入 GitHub Gist | {{</* gist username gistid */>}} |
| `highlight` | 代码高亮 | {{</* highlight go */>}}...{{</* /highlight */>}} |
| `youtube` | 嵌入 YouTube 视频 | {{</* youtube id */>}} |
| `vimeo` | 嵌入 Vimeo 视频 | {{</* vimeo id */>}} |
| `tweet` | 嵌入推文 | {{</* tweet user id */>}} |
| `instagram` | 嵌入 Instagram | {{</* instagram id */>}} |
| `param` | 输出站点参数 | {{</* param author */>}} |
| `ref` / `relref` | 站内链接 | {{</* ref "post/hello" */>}} |
| `details` | 折叠块（github-style 提供） | {{</* details "标题" */>}}...{{</* /details */>}} |

### 2.2 `figure`：带标题图片

```text
{{</* figure src="/images/avatar.png" title="头像" caption="这是我的头像" */>}}
```

### 2.3 `gist`：嵌入 Gist

```text
{{</* gist spf13 7896402 */>}}
```

### 2.4 `highlight`：代码高亮

`highlight` Shortcode 与围栏代码块类似，但能显式指定高亮语言与参数：

```text
{{</* highlight go "linenos=table,hl_lines=2 3" */>}}
package main
func main() {}
{{</* /highlight */>}}
```

### 2.5 `youtube`：嵌入视频

```text
{{</* youtube w7Ft2ymGmfc */>}}
```

### 2.6 自定义 Shortcode

在 `layouts/shortcodes/` 下放一个模板即可创建自定义 Shortcode。例如 `layouts/shortcodes/myshortcode.html`：

```html
<div class="my-box">{{ .Inner | markdownify }}</div>
```

在 Markdown 中调用：

```text
{{</* myshortcode */>}}
这里是**支持 Markdown** 的内容。
{{</* /myshortcode */>}}
```

github-style 主题的自定义 `details` Shortcode 就是这种用法（见 [github-style 主题]({{< ref "github-style" >}})）。

---

## 三、摘要分隔符 `<!--more-->`

在正文中插入 `<!--more-->`，其**之前**的内容会成为列表页摘要：

```markdown
这段是摘要，会显示在列表页。

<!--more-->

这段只在正文中显示。
```

> 与 `summary` 字段的区别：`summary` 只进列表页摘要、不进正文；`<!--more-->` 之前的内容**同时**进入摘要与正文。

---

## 四、代码高亮（Chroma）

Hugo 使用 [Chroma](https://github.com/alecthomas/chroma) 进行语法高亮，支持 200+ 语言。

### 4.1 围栏代码块高亮

在围栏后标注语言即可：

````markdown
```go
func main() {
    fmt.Println("Hello")
}
```
````

### 4.2 高亮行

围栏代码块支持在语言后添加 `{hl_lines=[2]}` 之类参数高亮指定行：

````markdown
```go {hl_lines=[2]}
func main() {
    fmt.Println("Hello")  // 这一行会被高亮
}
```
````

### 4.3 相关配置

```toml
# 使用 CSS 类而非内联样式（推荐，配合主题样式）
pygmentsUseClasses = true
# 是否高亮代码围栏（Goldmark 接管）
pygmentsCodeFences = true
```

---

## 五、站内链接：`ref` 与 `relref`

在 Hugo 中，站内跨页链接**不要**写死 URL，而应使用 `ref`（绝对链接）或 `relref`（相对链接）Shortcode，这样即使 URL 结构变化也能正确解析：

```text
[安装文档]({{</* ref "installation" */>}})

[相对链接到安装文档]({{</* relref "installation" */>}})

[某个页面]({{</* ref "post/hello.md" */>}})
```

- `ref` 输出绝对 URL（含 `baseURL`）。
- `relref` 输出相对于当前页面的 URL。
- 目标可以是文件路径（相对当前页）或内容路径（相对 `content/` 根）。

本文所有分文档之间的引用均使用 `ref` Shortcode（见 [总览]({{< ref "/post/hugo-guide" >}})）。

---

## 六、页面资源与图片（Page Resources）

### 6.1 静态资源（`static/`）

放在 `static/` 下的文件原样复制到站点根。引用方式：

```markdown
![图片](/images/avatar.png)
```

### 6.2 页面束（Page Bundle）

把一篇文章做成一个目录 + `index.md`，同目录下的图片可作为「页面资源」被处理：

```text
content/
└── post/
    └── my-post/
        ├── index.md
        └── cover.jpg
```

模板中通过 `.Resources` 访问并做裁剪、缩放、压缩等处理。这是 Hugo 处理本地图片的推荐方式（Leaf Bundle）。

### 6.3 全局资源（`assets/`）

`assets/` 下的资源可通过 Hugo Pipes 处理（SCSS 编译、JS 打包、图片处理等），在模板中用 `resources.Get` 引用。

---

## 七、Goldmark 配置（Markdown 渲染器）

Hugo 默认使用 Goldmark 渲染 Markdown，可在 `hugo.toml` 的 `[markup]` 下配置：

```toml
[markup]
  [markup.goldmark]
    [markup.goldmark.renderer]
      unsafe = true        # 允许渲染原始 HTML（默认 false，会过滤 script 等）
  [markup.highlight]
    style = "github"       # 代码高亮主题
    lineNos = false        # 是否显示行号
    guessSyntax = true     # 自动猜测语言
```

要点：

- `unsafe = true`：允许 Markdown 中的原始 HTML 直接输出（默认关闭，避免 XSS）。
- `[markup.highlight]`：配置 Chroma 高亮样式（`style` 可选 `github`、`monokai`、`dracula` 等）。

### 7.1 Emoji

```toml
enableEmoji = true   # 启用 Emoji 支持
```

---

## 八、模板变量在内容中的使用

Hugo 允许在 Markdown 中嵌入少量模板语法，例如：

```markdown
当前站点标题：{{ .Site.Title }}
```

但更规范的做法是用 Shortcode 封装，避免在内容里混入过多模板逻辑。

---

## 九、速查表

| 能力 | 写法 |
| --- | --- |
| Front Matter（TOML） | `+++` 包裹键值对 |
| 摘要分隔符 | `<!--more-->` |
| 内置 Shortcode | {{</* figure ... */>}}、{{</* gist ... */>}} 等 |
| 代码高亮 | 围栏代码块标注语言，或用 {{</* highlight go */>}} |
| 站内链接 | {{</* ref "path" */>}} / {{</* relref "path" */>}} |
| 站点参数 | {{</* param author */>}} |
| 原始 HTML | 需 `[markup.goldmark.renderer] unsafe = true` |

回到 [总览]({{< ref "/post/hugo-guide" >}}) 查看完整文档导航，或阅读 [github-style 主题]({{< ref "github-style" >}}) 了解主题专有格式。
