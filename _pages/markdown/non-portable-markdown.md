---
title: "不可移植的 Markdown 格式说明"
permalink: /markdown/non-portable-markdown/
---

{% raw %}

本文档整理那些在 Minimal Mistakes / Jekyll 中有效，但换到其他平台通常会失效、显示异常或含义改变的写法。

---

## 1. YAML Front Matter 专属字段

Jekyll / Minimal Mistakes 文章顶部常见：

```yaml
---
layout: single
title: "标题"
date: 2026-08-30
categories:
  - notes
tags:
  - 随笔
permalink: /notes/example/
author_profile: true
toc: true
comments: true
share: true
related: true
---
```

### 问题

- GitHub README 通常不解析 Front Matter。
- Notion、语雀、CSDN 等平台可能直接显示出来。
- Hugo、Hexo、VuePress 虽然也支持 Front Matter，但字段名和含义不同。
- `layout`、`permalink`、`author_profile`、`comments`、`share`、`related` 等是 Jekyll / 主题专属。

### 替代方案

- 发到普通平台：删除 Front Matter。
- 发到 Hugo：改用 Hugo 的 Front Matter，例如 `url` 代替 `permalink`。
- 发到 Obsidian：可保留为 properties，但不要期望其他平台识别。

---

## 2. Kramdown 属性

Minimal Mistakes 默认使用 Kramdown，支持：

```markdown
![图片](/assets/images/example.png){: .align-center}
![图片](/assets/images/example.png){: .align-left}
![图片](/assets/images/example.png){: .align-right}
```

### 问题

`{: .align-center}` 是 Kramdown 专属语法。  
在 GitHub、Notion、语雀、CSDN、Obsidian 等平台，可能直接显示为文字，或者被忽略。

### 替代方案

使用 HTML：

```html
<div align="center">
  <img src="/assets/images/example.png" alt="图片">
</div>
```

或使用平台自带的对齐功能。

---

## 3. Liquid 标签

Minimal Mistakes / Jekyll 支持 Liquid：

```markdown
{% include gallery caption="画廊说明" %}
{% capture example %}
内容
{% endcapture %}
{{ example | markdownify }}
```

### 问题

Liquid 是 Jekyll 模板语言，不是 Markdown。  
在其他平台中，`{% ... %}` 和 `{{ ... }}` 通常会原样显示，或者被当作普通文本。

### 替代方案

- 画廊：改成普通图片列表。
- 变量：直接写死内容。
- 逻辑：删除，或改用目标平台支持的模板语法。

---

## 4. 主题 CSS 类

Minimal Mistakes 提示框：

```html
<div class="notice--success">
  <h2 class="no_toc">示例</h2>
  这是提示内容。
</div>
```

可用类：

- `notice`
- `notice--primary`
- `notice--info`
- `notice--warning`
- `notice--danger`
- `notice--success`

### 问题

这些类依赖 Minimal Mistakes 的 CSS。  
换到其他平台后，`notice--success` 不会变成彩色提示框，通常只是普通 `div`，甚至没有样式。

### 替代方案

使用引用块：

```markdown
> **提示**  
> 这是提示内容。
```

或使用平台自带的 callout：

```markdown
> [!NOTE]
> 这是提示内容。
```

---

## 5. 图片路径 `/assets/...`

Minimal Mistakes 常用：

```markdown
![图片](/assets/images/example.png)
```

### 问题

`/assets/...` 是 Jekyll 站点根目录路径。  
换到其他平台后，如果图片没有一起迁移，链接会 404。

### 替代方案

- 使用完整 URL。
- 使用相对路径。
- 使用图床。
- 迁移时同步复制 `assets` 目录。

---

## 6. Jekyll 目录约定

Minimal Mistakes 文章放在：

```text
_posts/YYYY-MM-DD-标题.md
```

页面放在根目录：

```text
about.md
contact.md
index.md
```

导航配置放在：

```text
_data/navigation.yml
```

### 问题

这些是 Jekyll 的目录约定。  
其他平台不一定有 `_posts`、`_data`、`_config.yml` 这些概念。

### 替代方案

- 普通平台：直接写普通 Markdown 文件。
- Hugo：使用 `content/posts/`。
- Hexo：使用 `source/_posts/`。

---

## 7. permalink

Jekyll 写法：

```yaml
permalink: /notes/cloud-native-storage-opening/
```

### 问题

`permalink` 是 Jekyll 专属字段。  
Hugo 使用 `url`，Hexo 使用 `permalink` 但规则不同，其他平台可能完全不支持。

### 替代方案

- Hugo：`url: /notes/cloud-native-storage-opening/`
- 普通平台：使用平台自己的链接规则。
- 如果只是普通文档，直接删除。

---

## 8. layout

Jekyll 写法：

```yaml
layout: single
layout: archive
layout: splash
layout: home
layout: collection
```

### 问题

`layout` 是 Jekyll 主题布局系统。  
其他平台没有 `single`、`archive`、`splash` 这些布局。

### 替代方案

- 删除。
- 使用平台模板或主题自己的配置。

---

## 9. toc、author_profile、comments、share、related

```yaml
toc: true
author_profile: true
comments: true
share: true
related: true
```

### 问题

这些是 Minimal Mistakes / Jekyll 的功能开关。  
换平台后：

- `toc` 可能不生成目录。
- `author_profile` 没有作者侧栏。
- `comments` 不会自动接入评论系统。
- `share` 不会出现分享按钮。
- `related` 不会显示相关文章。

### 替代方案

- 目录：使用平台自带目录功能。
- 评论：接入目标平台评论系统。
- 分享：使用平台自带分享。
- 相关文章：使用平台推荐或手动添加。

---

## 10. Liquid 驱动的 CSV 表格

Minimal Mistakes / Jekyll 可以这样：

```liquid
{% assign csv = site.data.your_csv_file %}
<table>
  <thead>
    <tr>
      <th>列标题1</th>
      <th>列标题2</th>
    </tr>
  </thead>
  <tbody>
    {% for row in csv %}
    <tr>
      <td>{{ row.column1 }}</td>
      <td>{{ row.column2 }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>
```

### 问题

依赖 Jekyll 的 `site.data` 和 Liquid 循环。  
其他平台无法解析。

### 替代方案

- 直接写静态 Markdown 表格。
- 使用目标平台支持的数据表格组件。

---

## 11. 数学公式的依赖

```markdown
$$
E = mc^2
$$
```

数学语法本身可移植，但渲染依赖平台。  
Minimal Mistakes 默认不启用数学渲染，需要手动引入 MathJax 或 KaTeX。

### 替代方案

- 确认目标平台支持数学公式。
- 不支持时，使用图片或纯文本。

---

## 12. 总结

不可移植的典型内容包括：

- Jekyll Front Matter 专属字段
- Kramdown 属性
- Liquid 标签
- Minimal Mistakes 主题 CSS 类
- Jekyll 目录约定
- `permalink`、`layout`、`toc`、`author_profile` 等配置
- Liquid 驱动的 CSV 表格
- 依赖主题的图片路径和样式

{% endraw %}
