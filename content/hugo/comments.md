+++
title = "评论组件：Gitalk 与 Vssue"
date = 2026-11-15T09:25:00+08:00
draft = false
author = ""
keywords = ["gitalk", "vssue", "评论", "评论系统", "github issues", "对比"]
summary = "详细介绍 Gitalk 与 Vssue 两种评论系统的原理、安装配置、优缺点，并给出对比与选型建议。"
tags = ["comments", "gitalk", "vssue"]
+++

# 评论组件：Gitalk 与 Vssue

静态站点没有服务端，评论功能需要借助第三方服务。本文介绍两种基于「代码托管平台 Issue」的评论系统——**Gitalk** 与 **Vssue**，涵盖原理、安装配置、优缺点与选型对比，是 [总览]({{< ref "/post/hugo-guide" >}}) 中「评论组件」模块的展开。

<!--more-->

---

## 一、评论系统的共同思路

Gitalk 与 Vssue 的核心理念一致：**把每条评论映射到代码托管平台的一个 Issue**。

- 每个页面用一个 Issue 作为「评论容器」。
- 用户评论时，通过 OAuth 授权登录代码托管平台，将评论写入对应 Issue。
- 评论数据完全存储在平台（GitHub/GitLab/Gitee）的 Issue 里，站点本身不维护任何后端。

这种方式的好处是**无需自建数据库和后端**，缺点则是评论者必须拥有对应平台的账号。

---

## 二、Gitalk

### 2.1 简介

[Gitalk](https://github.com/gitalk/gitalk) 是一款基于 **GitHub Issue** 和 Preact 开发的评论组件，只支持 GitHub。它是 github-style 主题默认集成的评论方案。

### 2.2 工作原理

1. 页面加载时，Gitalk 用 `id`（默认为 `location.pathname`）在指定 GitHub 仓库中查找对应 Issue。
2. 若 Issue 不存在，且当前用户是管理员（`admin`），则自动创建 Issue。
3. 用户通过 GitHub OAuth 登录后，即可在 Issue 下发评论。
4. 评论内容最终全部沉淀在 GitHub Issue 中，可直接在仓库 Issues 页面查看和管理。

### 2.3 安装配置

**第一步：创建 GitHub OAuth App**

1. 打开 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。
2. 填写：
   - `Application name`：任意（如 `my-blog-comments`）。
   - `Homepage URL`：你的博客地址。
   - `Authorization callback URL`：你的博客地址（或部署域名）。
3. 创建后得到 **Client ID** 与 **Client Secret**（Secret 请妥善保管，勿提交到公开仓库）。

**第二步：在 github-style 中启用**

github-style 主题原生支持 Gitalk，在 `hugo.toml` 中配置即可：

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
    proxy = ""
```

**第三步（其他框架/通用站点）**：通过 npm 或 CDN 引入：

```bash
npm i gitalk
```

```js
import Gitalk from 'gitalk'

const gitalk = new Gitalk({
  clientID: 'GitHub Client ID',
  clientSecret: 'GitHub Client Secret',
  repo: 'GitHub repo',
  owner: 'GitHub repo owner',
  admin: ['GitHub repo owner'],
  id: location.pathname,
})
gitalk.render('gitalk-container')
```

### 2.4 配置项说明

| 配置 | 说明 |
| --- | --- |
| `clientID` / `clientSecret` | GitHub OAuth App 凭证 |
| `repo` | 存放评论 Issue 的仓库 |
| `owner` / `admin` | 仓库所有者 / 有权限创建 Issue 的管理员 |
| `id` | 评论的唯一标识，默认 `location.pathname` |
| `labels` | 自动创建的 Issue 标签 |
| `perPage` | 每页评论数（最大 100） |
| `pagerDirection` | 排序方向，`last`（最新在最后）或 `first` |
| `createIssueManually` | 是否手动创建 Issue（`true` 则管理员登录后自动创建） |
| `distractionFreeMode` | 无干扰模式，支持 `Cmd/Ctrl + Enter` 提交 |
| `proxy` | OAuth 反向代理（解决 GitHub API 在某些网络环境不可达的问题） |

### 2.5 优缺点

**优点**：

- 配置简单，github-style 主题开箱即用。
- 评论沉淀在 GitHub Issue，便于集中管理、搜索与备份。
- 界面简洁，与 GitHub 风格统一。

**缺点**：

- **仅支持 GitHub**，评论者必须有 GitHub 账号。
- 需要申请 OAuth App，`clientSecret` 泄露有安全风险（应配合代理或服务端保管）。
- 在国内部分网络环境下，GitHub API 可能访问不稳定，需配置 `proxy`。

---

## 三、Vssue

### 3.1 简介

[Vssue](https://vssue.js.org/) 同样是把评论存为 Issue 的组件，但它是为 **Vue** 生态设计的，且**支持多个平台**：GitHub、GitLab、Gitee、Bitbucket（及其自建实例）。

### 3.2 工作原理

与 Gitalk 相同：每个页面对应一个 Issue，评论写入 Issue。区别在于 Vssue 通过**平台 API 适配层**（`@vssue/api-github-v3`、`@vssue/api-gitlab-v4` 等）抽象了不同平台的差异，因此一套组件可对接多种平台。

### 3.3 安装配置

Vssue 主要面向 Vue 应用，VuePress / VitePress 文档站最常用。以下为通用接入方式：

```bash
npm install @vssue/vue @vssue/api-github-v3
```

```js
import Vssue from '@vssue/vue'
import GithubV3 from '@vssue/api-github-v3'

export default {
  components: { Vssue },
  data() {
    return {
      title: '评论',
      options: {
        api: GithubV3,
        owner: 'OWNER_OF_REPO',
        repo: 'NAME_OF_REPO',
        clientId: 'YOUR_CLIENT_ID',
        clientSecret: 'YOUR_CLIENT_SECRET',
        // Gitee 示例：api 改用 GiteeV5
        // GitLab 示例：api 改用 GitlabV4，并额外配置 baseURL
      },
    }
  },
}
```

**GitHub 之外平台示例（Gitee）**：

```js
import GiteeV5 from '@vssue/api-gitee-v5'

const options = {
  api: GiteeV5,
  owner: 'OWNER',
  repo: 'REPO',
  clientId: 'GITEE_CLIENT_ID',
  clientSecret: 'GITEE_CLIENT_SECRET',
}
```

**GitLab 示例**：

```js
import GitlabV4 from '@vssue/api-gitlab-v4'

const options = {
  api: GitlabV4,
  baseURL: 'https://gitlab.com',   // 或自建 GitLab 实例地址
  owner: 'OWNER',
  repo: 'REPO',
  clientId: 'GITLAB_APP_ID',
  clientSecret: 'GITLAB_APP_SECRET',
}
```

> 各平台的 OAuth App 创建流程类似：在对应平台的「应用/开发者设置」里创建 OAuth 应用，获取 `clientId` 与 `clientSecret`。

### 3.4 优缺点

**优点**：

- **多平台支持**：GitHub、GitLab、Gitee、Bitbucket，国内用户可用 Gitee 获得更稳定的访问体验。
- 对 Vue 生态（VuePress、VitePress、Vue CLI）集成良好。
- 同样把评论沉淀到 Issue，便于管理。

**缺点**：

- 依赖 Vue，**非 Vue 站点集成成本较高**（Hugo 站引入需额外加载 Vue 运行时）。
- 配置相对 Gitalk 略复杂（需要理解 `api` 适配层）。
- 需要分别申请对应平台的 OAuth 应用。

---

## 四、Gitalk 与 Vssue 对比

| 维度 | Gitalk | Vssue |
| --- | --- | --- |
| 支持平台 | 仅 GitHub | GitHub / GitLab / Gitee / Bitbucket |
| 技术栈 | Preact（轻量） | Vue（需 Vue 运行时） |
| 集成难度 | 低（主题开箱即用） | 中（Vue 生态更友好） |
| 多平台切换 | 不支持 | 支持（换 `api` 适配器） |
| 国内可用性 | 依赖 GitHub API，可能需代理 | 可用 Gitee 提升国内体验 |
| 评论存储 | GitHub Issue | 各平台 Issue |
| 界面风格 | 简洁、GitHub 风 | 简洁，可自定义主题 |
| 适合场景 | GitHub 用户、Hugo 站 | 多平台需求、Vue 文档站 |

---

## 五、选型建议

- **本站（github-style + Hugo）**：直接使用主题集成的 **Gitalk**，配置最少、最贴合 GitHub 风格。见 [github-style 主题]({{< ref "github-style" >}})。
- **面向国内用户**：若担心 GitHub 访问不稳定，可考虑 **Vssue + Gitee**，或为 Gitalk 配置 `proxy`。
- **多平台 / 自建 GitLab**：选 **Vssue**，通过 `api` 适配层对接 GitLab 或 Bitbucket。
- **VuePress / VitePress 文档站**：优先 **Vssue**，集成最自然。

---

回到 [总览]({{< ref "/post/hugo-guide" >}}) 查看完整文档导航。
