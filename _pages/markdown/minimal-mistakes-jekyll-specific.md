---
title: "关于minimal-mistakes主题专属格式"
permalink: /markdown/minimal-mistakes-jekyll-specific/
---

{% raw %}

本文档整理 Minimal Mistakes 主题和 Jekyll 中专属的 Markdown 写法、Front Matter 参数、布局、Liquid 标签、文件结构和完整实例。

---

## 1. YAML Front Matter 通用参数

每个 Markdown 文件顶部都可以添加：

```yaml
---
layout: single
title: "页面标题"
date: 2026-08-30
categories:
  - notes
tags:
  - 随笔
---
```

### 常用参数表

| 参数 | 描述 | 示例 |
|---|---|---|
| `layout` | 指定布局模板 | `layout: single` |
| `title` | 页面标题 | `title: "我的文章"` |
| `permalink` | 自定义 URL 路径 | `permalink: /custom-path/` |
| `date` | 发布日期 | `date: 2026-08-30` |
| `excerpt` | 摘要，用于 SEO 和列表展示 | `excerpt: "这是摘要"` |
| `header` | 页眉图片设置 | `header: {image: "/assets/images/photo.jpg"}` |
| `author_profile` | 是否显示作者侧边栏 | `author_profile: true` |
| `toc` | 是否启用目录 | `toc: true` |
| `comments` | 是否启用评论 | `comments: true` |
| `share` | 是否启用社交分享 | `share: true` |
| `related` | 是否显示相关文章 | `related: true` |
| `classes` | 添加自定义 CSS 类 | `classes: wide` |
| `search` | 是否包含在搜索中 | `search: false` |

---

## 2. 各布局专用 Front Matter

### 2.1 Single 布局

最常用于文章和独立页面。

```yaml
---
layout: single
title: "页面标题"
permalink: /permalink/
date: 2026-08-30
last_modified_at: 2026-08-31
excerpt: "页面描述"
author_profile: true
read_time: true
comments: true
share: true
related: true
toc: true
toc_label: "我的目录"
toc_icon: "cog"
toc_sticky: true
classes: wide
---
```

### 2.2 Archive 布局

用于归档和分类页面。

```yaml
---
layout: archive
title: "归档标题"
permalink: /archive-permalink/
author_profile: true
---
```

### 2.3 Collection 布局

用于集合归档。

```yaml
---
title: 集合标题
layout: collection
permalink: /collection-name/
collection: collection-name
entries_layout: grid
sort_by: date
sort_order: forward
---
```

`entries_layout` 可选：

- `grid`
- `list`

`sort_by` 可选：

- `date`
- `title`
- 其他元数据键

`sort_order` 可选：

- `forward`
- `reverse`

### 2.4 Home 布局

主页布局。

```yaml
---
layout: home
author_profile: true
entries_layout: grid
---
```

### 2.5 Splash 布局

全宽落地页布局。

```yaml
---
layout: splash
title: "落地页"
header:
  overlay_color: "#000"
  overlay_filter: "0.5"
  overlay_image: /assets/images/unsplash-image.jpg
  actions:
    - label: "下载"
      url: "https://github.com/mmistakes/minimal-mistakes/"
excerpt: "这是落地页的简短描述。"
---
```

---

## 3. 页面与文章位置

### 页面

页面类 Markdown 文件通常放在项目根目录，例如：

```text
about.md
contact.md
index.md
```

如需出现在导航栏，还需在 `_data/navigation.yml` 中注册。

### 文章

文章放在 `_posts/` 目录下，文件名格式为：

```text
YYYY-MM-DD-标题.md
```

例如：

```text
_posts/2026-08-30-cloud-native-storage-opening.md
```

或：

```text
_posts/2026-08-30-开篇-把存储经验搬到云原生.md
```

---

## 4. 特色功能与实例

### 4.1 目录

在 Front Matter 中设置 `toc: true` 即可自动根据标题层级生成目录。

```yaml
toc: true
toc_label: "文章目录"
toc_icon: "cog"
toc_sticky: true
```

### 4.2 代码块与语法高亮

使用三重反引号并指定语言即可获得语法高亮。

```java
class Solution {
    public int[] solution(String[] phone_book) {
        boolean answer = true;
        Arrays.sort(phone_book);
        for (int i = 0; i < phone_book.length - 1; i++) {
            if (phone_book[i + 1].startsWith(phone_book[i])) {
                answer = false;
                break;
            }
        }
        return answer;
    }
}
```

### 4.3 图片与对齐

标准 Markdown 图片语法：

```markdown
![图片描述](/assets/images/example.png)
```

添加 Kramdown 对齐类：

```markdown
![居中图片](/assets/images/example.png){: .align-center}
![左对齐图片](/assets/images/example.png){: .align-left}
![右对齐图片](/assets/images/example.png){: .align-right}
```

### 4.4 图片画廊 Gallery

需要在 Front Matter 中定义 `gallery` 数组，然后使用 `{% include gallery %}` 标签调用。

Front Matter 定义：

```yaml
gallery:
  - url: /assets/images/unsplash-gallery-image-1.jpg
    image_path: /assets/images/unsplash-gallery-image-1-th.jpg
    alt: "placeholder image 1"
    title: "Image 1 title caption"
  - url: /assets/images/unsplash-gallery-image-2.jpg
    image_path: /assets/images/unsplash-gallery-image-2-th.jpg
    alt: "placeholder image 2"
    title: "Image 2 title caption"
```

页面中调用：

```markdown
{% include gallery caption="这是一个支持 **Markdown** 的示例画廊。" %}
{% include gallery id="gallery2" caption="这是第二个画廊。" %}
{% include gallery id="gallery" layout="half" caption="这是两列画廊布局。" %}
```

还可通过 `class="full"` 让画廊占满整个内容容器。

### 4.5 提示框 Notice Blocks

通过 `<div>` 包裹并添加 `notice--*` 类来创建彩色提示框。

```markdown
{% capture example %}
这是提示框中的内容，支持 **Markdown**。
{% endcapture %}

<div class="notice--success">
  <h2 class="no_toc">示例</h2>
  {{ example | markdownify }}
</div>
```

可用类型包括：

- `notice`
- `notice--primary`
- `notice--info`
- `notice--warning`
- `notice--danger`
- `notice--success`

### 4.6 数学公式 LaTeX / MathJax

主题默认不启用数学渲染，需要手动添加 MathJax 或 KaTeX。

启用方式：

- 在 `_config.yml` 或页面中引入 MathJax 脚本
- 在 Front Matter 中设置 `use_math: true`

行内公式：

```markdown
当 $a \neq 0$ 时，方程 $ax^2 + bx + c = 0$ 有两个解。
```

块级公式：

```markdown
$$
E[X] = \sum_{i=1}^{k-1}\sum_{j=i+1}^{k} X_{ij}Pr[\text{i and j have the same birthday}]
$$
```

### 4.7 表格

标准 Markdown 表格语法，支持列对齐。

```markdown
| 姓名   | 薪资 | 备注                     |
| :----- | :--: | -----------------------: |
| John   | $1   | 这是左对齐、居中、右对齐 |
| Jane   | $2   | 对齐方式由冒号位置决定   |
```

- `:---` 左对齐（默认）
- `:---:` 居中对齐
- `---:` 右对齐

### 4.8 进阶数据表格 CSV 驱动

若数据量大，可将 CSV 文件放入 `_data/` 目录，用 Liquid 循环生成表格。

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

### 4.9 其他标准 Markdown 元素

#### 引用块

```markdown
> 这是一段引用文字。
```

#### 列表

```markdown
- 无序列表项一
- 无序列表项二
  - 嵌套项

1. 有序列表项一
2. 有序列表项二
```

#### 强调

```markdown
**加粗**、*斜体*、~~删除线~~、`行内代码`
```

#### 水平分割线

```markdown
---
```

#### 链接

```markdown
[链接文字](https://example.com)
```

---

## 5. permalink 详解

`permalink` 是 **permanent link** 的缩写，中文常叫 **永久链接**。

在 Jekyll / Minimal Mistakes 里，它的作用是：手动指定这个页面或文章最终生成的 URL 地址，而不是让 Jekyll 按默认规则自动拼。

### 5.1 示例

```yaml
permalink: /notes/cloud-native-storage-opening/
```

访问地址固定为：

```text
https://你的域名/notes/cloud-native-storage-opening/
```

本地预览：

```text
http://localhost:4000/notes/cloud-native-storage-opening/
```

### 5.2 不写 permalink 会怎样？

Jekyll 会按照 `_config.yml` 里的全局规则自动生成 URL。

例如默认可能是：

```text
/:categories/:year/:month/:day/:title/
```

那么文章可能变成：

```text
/notes/2026/08/30/开篇-把存储经验搬到云原生/
```

或：

```text
/notes/2026/08/30/开篇-把存储经验搬到云原生.html
```

具体取决于 `_config.yml` 配置。

### 5.3 permalink 的好处

- URL 更短、更好看
- URL 更稳定
- 对 SEO 更友好
- 方便分享

### 5.4 常见写法

文章固定路径：

```yaml
permalink: /notes/cloud-native-storage-opening/
```

带 `.html` 的路径：

```yaml
permalink: /about.html
```

页面固定路径：

```yaml
permalink: /about/
```

使用变量：

```yaml
permalink: /:categories/:title/
```

常用变量：

| 变量 | 含义 |
|---|---|
| `:year` | 年份 |
| `:month` | 月份 |
| `:day` | 日期 |
| `:title` | 标题 slug |
| `:slug` | 文件名中的 slug |
| `:categories` | 分类 |
| `:output_ext` | 输出扩展名，如 `.html` |

### 5.5 注意事项

1. 开头一般要加 `/`，表示从网站根目录开始。
2. 结尾加不加 `/` 有区别。
3. 不要和已有页面冲突。
4. 改了 `permalink`，旧链接会失效。
5. 最终 URL 还受 `url` 和 `baseurl` 影响。
6. 中文路径不建议直接写在 `permalink` 里。

### 5.6 一句话总结

`permalink` 就是手动给页面或文章指定最终 URL。  
不写，Jekyll 自动生成；写了，就按你指定的路径访问。

---

## 6. 完整文章实例

```markdown
---
layout: single
title: "我的旅行记录"
date: 2026-06-15
excerpt: "记录旅途中的美好瞬间。"
author_profile: true
toc: true
toc_label: "本文目录"
toc_sticky: true
comments: true
share: true
related: true
gallery:
  - url: /assets/images/beach-1.jpg
    image_path: /assets/images/beach-1-th.jpg
    alt: "海滩日落"
    title: "海滩日落"
  - url: /assets/images/mountain-1.jpg
    image_path: /assets/images/mountain-1-th.jpg
    alt: "山间晨雾"
    title: "山间晨雾"
---

## 第一天：抵达海边

清晨出发，中午抵达。海风带着咸味，沙滩被阳光晒得发白。

> 旅行是唯一让你花了钱却变得更富有的事情。

![海景图](/assets/images/sea-view.jpg){: .align-center}

## 第二天：登山

山路蜿蜒，雾气缭绕。

```python
def greet(name):
    return f"Hello, {name}!"
```

## 画廊

{% include gallery caption="这次旅行的精选照片。" %}

## 小结

这次旅行让我重新认识了自然的壮美。
```

---

## 7. 建议补全的 Front Matter

对于一篇 Minimal Mistakes 文章，建议补全以下字段：

```yaml
---
layout: single
title: "开篇：把存储经验搬到云原生"
date: 2026-08-30 00:00:00 +0800
categories:
  - notes
tags:
  - 随笔
excerpt: "开篇：把存储经验搬到云原生。"
author_profile: true
toc: true
toc_sticky: true
comments: true
share: true
related: true
permalink: /notes/cloud-native-storage-opening/
---
```

---

## 8. 总结

Minimal Mistakes / Jekyll 专属内容包括：

- YAML Front Matter 各种参数
- Single、Archive、Collection、Home、Splash 布局
- TOC、Gallery、Notice、图片对齐
- Liquid 标签
- `_posts`、`_data/navigation.yml`、`_config.yml`
- `permalink`、`layout`、`categories`、`tags`
- 评论、分享、相关文章、作者侧栏

{% endraw %}
