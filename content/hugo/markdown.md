+++
title = "通用 Markdown 语法"
date = 2026-11-15T09:15:00+08:00
draft = false
author = ""
keywords = ["markdown", "gfm", "语法", "格式", "表格", "代码块"]
summary = "跨环境通用的 Markdown 语法与格式参考：标题、段落、强调、列表、链接、图片、代码、表格、引用、任务列表、脚注等，全部用 Markdown 本身演示。"
tags = ["markdown", "guide"]
+++

# 通用 Markdown 语法

本文介绍**所有环境通用**的 Markdown 语法与格式，是 [总览]({{< ref "/post/hugo-guide" >}}) 中「Markdown 写作规范」的基础篇。Hugo 的渲染器 Goldmark 以 GitHub Flavored Markdown（GFM）为基础并扩展了部分语法，因此本文覆盖 GFM 的完整能力。

> 写作约定：为做到「用 Markdown 描述 Markdown」，本文每个语法点都先给出**源码**（放在 ` ```markdown ` 代码块里），再给出**渲染效果**（直接用该语法书写）。Hugo 专有的格式见 [Hugo 专有 Markdown 与 Shortcodes]({{< ref "hugo-markdown" >}})，github-style 专有的格式见 [github-style 主题]({{< ref "github-style" >}})。

<!--more-->

---

## 一、标题（Headings）

源码：

```markdown
# 一级标题

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

一级标题（Setext 风格）
===

二级标题（Setext 风格）
---
```

渲染效果：

# 一级标题

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

> 提示：在 Hugo/github-style 中，正文建议从二级标题（`##`）开始，因为页面标题本身已作为一级标题显示，`##` 起的标题也会被 TOC 正确收集。

---

## 二、段落与换行

源码：

```markdown
这是第一个段落。段落之间用空行分隔。

这是第二个段落。
在 Markdown 中，单个换行不会被渲染成换行，
它会合并到同一段落里。

要在段落内强制换行，可以在行尾加两个空格，  
或者加一个反斜杠 \
然后换行。
```

渲染效果：

这是第一个段落。段落之间用空行分隔。

这是第二个段落。
在 Markdown 中，单个换行不会被渲染成换行，
它会合并到同一段落里。

要在段落内强制换行，可以在行尾加两个空格，  
或者加一个反斜杠 \
然后换行。

---

## 三、强调（Emphasis）

源码：

```markdown
**这是粗体**

__这也是粗体__

*这是斜体*

_这也是斜体_

***这是粗斜体***

~~这是删除线~~

`这是行内代码`
```

渲染效果：

**这是粗体**

__这也是粗体__

*这是斜体*

_这也是斜体_

***这是粗斜体***

~~这是删除线~~

`这是行内代码`

---

## 四、列表（Lists）

### 4.1 无序列表

源码：

```markdown
- 项目一
- 项目二
  - 嵌套子项
  - 嵌套子项二
- 项目三
```

渲染效果：

- 项目一
- 项目二
  - 嵌套子项
  - 嵌套子项二
- 项目三

### 4.2 有序列表

源码：

```markdown
1. 第一项
2. 第二项
   1. 嵌套第一项
   2. 嵌套第二项
3. 第三项
```

渲染效果：

1. 第一项
2. 第二项
   1. 嵌套第一项
   2. 嵌套第二项
3. 第三项

### 4.3 任务列表（Task List）

源码：

```markdown
- [x] 已完成的任务
- [x] 另一个已完成
- [ ] 未完成的任务
```

渲染效果：

- [x] 已完成的任务
- [x] 另一个已完成
- [ ] 未完成的任务

---

## 五、链接（Links）

### 5.1 行内链接

源码：

```markdown
[GitHub](https://github.com)

[带标题的链接](https://gohugo.io "Hugo 官网")
```

渲染效果：

[GitHub](https://github.com)

[带标题的链接](https://gohugo.io "Hugo 官网")

### 5.2 引用式链接

源码：

```markdown
[Hugo 官网][hugo]

[hugo]: https://gohugo.io "Hugo"
```

渲染效果：

[Hugo 官网][hugo]

[hugo]: https://gohugo.io "Hugo"

### 5.3 自动链接（Autolink）

源码：

```markdown
<https://gohugo.io>

<user@example.com>
```

渲染效果：

<https://gohugo.io>

<user@example.com>

> 在 Hugo 站点内部，跨页面引用应使用 Hugo 的 `ref`/`relref` 短代码，见 [Hugo 专有 Markdown 与 Shortcodes]({{< ref "hugo-markdown" >}})。

---

## 六、图片（Images）

源码：

```markdown
![替代文字](https://example.com/image.png)

![带标题的图片](https://example.com/image.png "图片标题")
```

渲染效果：

![替代文字](https://example.com/image.png)

> 在 Hugo 中，本地图片建议用页面资源或 `static/` 目录管理，见 [Hugo 专有 Markdown 与 Shortcodes]({{< ref "hugo-markdown" >}})。

---

## 七、代码（Code）

### 7.1 行内代码

源码：

```markdown
使用 `hugo server` 启动开发服务器。
```

渲染效果：

使用 `hugo server` 启动开发服务器。

### 7.2 围栏代码块（Fenced Code Block）

源码：

````markdown
```python
def hello(name):
    return f"Hello, {name}!"
```
````

渲染效果：

```python
def hello(name):
    return f"Hello, {name}!"
```

> 围栏代码块支持**语言标注**用于语法高亮，Hugo 使用 Chroma 实现，详见 [Hugo 专有 Markdown 与 Shortcodes]({{< ref "hugo-markdown" >}})。

### 7.3 缩进代码块

源码（四个空格缩进）：

```markdown
    这是缩进代码块
    不支持语言高亮
```

渲染效果：

    这是缩进代码块
    不支持语言高亮

---

## 八、表格（Tables）

源码：

```markdown
| 名称 | 版本 | 说明 |
| --- | --- | --- |
| Hugo | 0.118+ | 静态站点生成器 |
| Goldmark | 1.7 | Markdown 渲染器 |
| github-style | - | GitHub 风格主题 |
```

渲染效果：

| 名称 | 版本 | 说明 |
| --- | --- | --- |
| Hugo | 0.118+ | 静态站点生成器 |
| Goldmark | 1.7 | Markdown 渲染器 |
| github-style | - | GitHub 风格主题 |

对齐控制：

```markdown
| 左对齐 | 居中 | 右对齐 |
| :--- | :---: | ---: |
| 内容 | 内容 | 内容 |
```

渲染效果：

| 左对齐 | 居中 | 右对齐 |
| :--- | :---: | ---: |
| 内容 | 内容 | 内容 |

---

## 九、引用（Blockquote）

源码：

```markdown
> 这是一段引用。
>
> 引用可以跨多个段落。
>
> > 引用还可以嵌套。
```

渲染效果：

> 这是一段引用。
>
> 引用可以跨多个段落。
>
> > 引用还可以嵌套。

---

## 十、分隔线（Horizontal Rule）

源码：

```markdown
上面内容

---

下面内容
```

渲染效果：

上面内容

---

下面内容

---

## 十一、转义（Escaping）

源码：

```markdown
\*这段文字不会被斜体\*

\# 这不是标题

\` 这不是代码 \`
```

渲染效果：

\*这段文字不会被斜体\*

\# 这不是标题

\` 这不是代码 \`

---

## 十二、内联 HTML

Markdown 允许直接使用行内 HTML：

```markdown
这是 <mark>高亮标记</mark> 的文字。

<details>
<summary>HTML 折叠块</summary>

这里的内容可以用 HTML 书写。

</details>
```

> 注意：Hugo 默认的 Goldmark 安全策略（`unsafe = false`）会**过滤**原始 HTML，因此上面的 `<mark>`、`<details>` 等标签默认不会被渲染，而是被丢弃。如需让原始 HTML 生效，需在 `hugo.toml` 中开启：
>
> ```toml
> [markup]
>   [markup.goldmark]
>     [markup.goldmark.renderer]
>       unsafe = true
> ```
>
> 开启后，`<mark>高亮标记</mark>` 会渲染为高亮标记的效果，`<details>` 会渲染为可折叠块。完整配置见 [Hugo 专有 Markdown 与 Shortcodes]({{< ref "hugo-markdown" >}})。

---

## 十三、脚注（Footnotes）

源码：

```markdown
Hugo 由 Go 语言编写[^1]。

[^1]: 官网：https://gohugo.io
```

渲染效果：

Hugo 由 Go 语言编写[^1]。

[^1]: 官网：https://gohugo.io

---

## 十四、Emoji

GFM 风格的表情符号（如 `:tada:`）在 Hugo 中需通过配置或短代码启用。Hugo 的 `enableEmoji` 或 `emojify` 可处理 Unicode Emoji（如 `🚀`），详见 [Hugo 专有 Markdown 与 Shortcodes]({{< ref "hugo-markdown" >}})。

---

## 十五、速查表

| 语法 | 写法 |
| --- | --- |
| 标题 | `# H1` ~ `###### H6` |
| 粗体 | `**粗体**` |
| 斜体 | `*斜体*` |
| 删除线 | `~~删除线~~` |
| 行内代码 | `` `code` `` |
| 代码块 | ` ```lang ... ``` ` |
| 无序列表 | `- item` |
| 有序列表 | `1. item` |
| 任务列表 | `- [ ] item` / `- [x] item` |
| 链接 | `[文字](url)` |
| 图片 | `![替代](url)` |
| 表格 | `\| 列 \| 列 \|` + `\| --- \| --- \|` |
| 引用 | `> 引用` |
| 分隔线 | `---` |
| 脚注 | `[^1]` + `[^1]: 说明` |

通用 Markdown 是基础，写作时叠加使用 Hugo 与 github-style 的专有格式即可，详见 [Hugo 专有 Markdown 与 Shortcodes]({{< ref "hugo-markdown" >}}) 与 [github-style 主题]({{< ref "github-style" >}})。
