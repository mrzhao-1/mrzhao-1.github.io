+++
title = "Merge Request 全流程详解"
date = 2025-03-24T10:04:00+08:00
draft = false
author = ""
keywords = ["gitlab", "merge request", "mr", "代码评审", "ci/cd", "发布", "流程"]
summary = "从客户端编辑提交、创建 MR、CI 验证、代码评审、合并到主线，到部署与版本发布的完整业务流程，含各模块间数据流与流程图。"
tags = ["gitlab", "merge-request", "workflow", "release"]
+++

# Merge Request 全流程详解

本文详细描述一个 Merge Request（MR）从**客户端编辑提交 → 创建 MR → CI 验证 → 代码评审 → 合并到主线 → 部署与版本发布**的完整业务流，以及每个阶段各 GitLab 模块（Gitaly / PostgreSQL / Redis / Sidekiq / Puma / Workhorse / Runner）之间的协作关系。

<!--more-->

---

## 一、流程总览

端到端流程如下：

```text
客户端编辑提交 → 创建 MR → CI/CD 自动验证 → 代码评审 → 合并到主线 → 部署与版本发布
   (阶段一)      (阶段二)     (阶段三)        (阶段四)    (阶段五)      (阶段六)
```

各阶段的触发者、产物与关键模块：

| 阶段 | 触发者 | 关键产物 | 核心模块 |
| --- | --- | --- | --- |
| 客户端编辑提交 | 开发工程师 | feature 分支、commit | Gitaly、Workhorse、GitLab Shell |
| 创建 MR | 开发工程师 | MR 记录 | Puma、PostgreSQL、Redis |
| CI/CD 验证 | 系统自动 | Pipeline / Job | Sidekiq、Runner、PostgreSQL |
| 代码评审 | 评审人 | 评论、审批 | PostgreSQL、Puma |
| 合并到主线 | Maintainer | 合并提交 / 主线更新 | Gitaly、PostgreSQL、Sidekiq |
| 部署与版本发布 | 系统/发布负责人 | 部署、Tag、Release | Runner、Environments、Releases |

---

## 二、阶段一：客户端编辑与提交

### 2.1 说明

开发者从主线拉取代码，创建功能分支，在本地完成编码后提交并推送到 GitLab。

### 2.2 关键操作

```bash
git clone git@gitlab.example.com:group/project.git   # 克隆仓库
cd project
git checkout -b feature/login-optimize                 # 创建功能分支
# ... 本地编码 ...
git add .
git commit -m "feat: optimize login flow"              # 提交
git push -u origin feature/login-optimize              # 推送
```

### 2.3 涉及模块与数据流

```text
本地 git → [SSH] → GitLab Shell → [gRPC] → Gitaly（写入对象与 refs）
GitLab Shell → Workhorse → Puma → PostgreSQL（记录 push 事件）
Puma → Sidekiq（触发 post-receive 异步钩子：更新 MR 状态、发送通知）
```

- **Gitaly** 负责 Git 对象与分支引用的存储与变更。
- **GitLab Shell** 处理 SSH 会话，转发到 Gitaly。
- **Sidekiq** 异步执行 post-receive 钩子，更新关联 MR 的 diff 与流水线状态。

### 2.4 流程图

```text
┌─────────────┐   push   ┌──────────────┐  gRPC  ┌────────┐
│ 本地 Git 客户端│ ───────▶ │ GitLab Shell │ ─────▶ │ Gitaly │
└─────────────┘          └──────┬───────┘        └────────┘
                                │ 通知
                                ▼
                        ┌──────────────┐  写事件  ┌────────────┐
                        │   Puma/Rails  │ ───────▶ │ PostgreSQL │
                        └──────┬───────┘          └────────────┘
                               │ 入队
                               ▼
                        ┌──────────────┐
                        │    Sidekiq   │  ← post-receive 异步钩子
                        └──────────────┘
```

---

## 三、阶段二：创建 Merge Request

### 3.1 说明

推送后，GitLab 会在页面上提示「Create merge request」；也可手动创建。创建时指定源分支、目标分支（通常为主线 `main`/`master`），并填写标题、描述、指派人、评审人、标签、里程碑等。

### 3.2 关键操作

- 页面：`New merge request` → 选择 source/target 分支 → 填写信息 → 提交。
- 或推送时在输出中点击链接直接创建。

### 3.3 涉及模块与数据流

```text
浏览器 → Nginx → Workhorse → Puma → PostgreSQL（写入 merge_requests 记录）
Puma → Redis（缓存 MR 信息）
Puma → Sidekiq（生成 diff、刷新关联信息）
```

- **PostgreSQL** 持久化 MR 的元数据（源/目标分支、状态、指派人、评审人等）。
- **Redis** 缓存 MR 摘要与变更集，加速页面加载。
- **Sidekiq** 异步计算 diff、关联 Issue、发送通知。

### 3.4 流程图

```text
┌─────────┐   POST /merge_requests   ┌───────────┐  写记录  ┌────────────┐
│  浏览器  │ ───────────────────────▶ │ Puma/Rails │ ───────▶ │ PostgreSQL │
└─────────┘                          └─────┬─────┘          └────────────┘
                                           │ 入队
                                           ▼
                                     ┌───────────┐
                                     │  Sidekiq   │  ← 异步计算 diff、通知
                                     └───────────┘
```

---

## 四、阶段三：CI/CD 自动验证

### 4.1 说明

MR 创建或每次向源分支推送更新，都会根据 `.gitlab-ci.yml` 触发流水线，自动执行测试、构建、安全扫描等，并将结果回传到 MR 页面。

### 4.2 关键操作

- 项目内配置 `.gitlab-ci.yml`，定义 stage 与 job。
- Runner 需已注册并可用。

### 4.3 涉及模块与数据流

```text
Sidekiq（创建 Pipeline）→ PostgreSQL（pipeline/job 记录）→ Redis（队列）
→ GitLab Runner 拉取 job → 执行（构建/测试）→ 结果写回 PostgreSQL
→ Pipeline 状态更新 → MR 页面显示（通过/失败）
```

- **Sidekiq** 负责解析 `.gitlab-ci.yml` 并创建流水线与任务。
- **Runner** 是实际执行者，拉取任务、运行命令、回传结果。
- **PostgreSQL** 保存流水线、Job、产物元数据。

### 4.4 流程图

```text
push 更新 MR
   │
   ▼
┌───────────┐  解析 .gitlab-ci.yml  ┌────────────┐
│  Sidekiq  │ ────────────────────▶ │ PostgreSQL  │
└─────┬─────┘                       └────────────┘
      │ 任务入队
      ▼
┌───────────┐  拉取 job   ┌──────────────┐
│   Redis   │ ◀───────── │ GitLab Runner │
└───────────┘            └──────┬───────┘
                               │ 执行测试/构建/扫描
                               ▼
                       ┌──────────────┐  写结果  ┌────────────┐
                       │  Pipeline UI  │ ◀────── │ PostgreSQL │
                       └──────────────┘         └────────────┘
```

---

## 五、阶段四：代码评审

### 5.1 说明

评审人查看 diff，提出行内评论或整体讨论，必要时提交「代码建议」；讨论解决后给出批准（Approval）。若配置了「必须通过评审/审批才能合并」，则需满足规则。

### 5.2 关键操作

- 打开 MR 的 Changes 页逐行查看 diff。
- 行内评论 / 建议（Apply suggestion）。
- 解决讨论（Resolve thread）。
- 点击 Approve（审批）。

### 5.3 涉及模块与数据流

```text
浏览器 → Puma → PostgreSQL（写入 notes/approvals）
Puma → Redis（缓存讨论）
Sidekiq（应用 suggestion 后生成新 commit 并推送回分支）
```

### 5.4 流程图

```text
┌─────────┐  评论/建议   ┌───────────┐  写记录  ┌────────────┐
│  评审人  │ ───────────▶ │ Puma/Rails │ ───────▶ │ PostgreSQL │
└─────────┘              └─────┬─────┘          └────────────┘
                               │ 应用 suggestion
                               ▼
                        ┌───────────┐  新 commit   ┌────────┐
                        │  Sidekiq  │ ───────────▶ │ Gitaly │
                        └───────────┘              └────────┘
```

---

## 六、阶段五：合并到主线

### 6.1 说明

评审通过后，Maintainer 点击「Merge」将源分支合并到目标主线。合并方式有：合并提交（merge commit）、压缩提交（squash）、变基合并（rebase）、快进合并（fast-forward）。若有冲突需先解决。

### 6.2 关键操作

- 解决冲突（本地或 Web IDE）。
- 选择合并方式后点击 Merge。
- 可选：合并后自动删除源分支。

### 6.3 涉及模块与数据流

```text
Puma → Gitaly（执行 merge，更新主线 refs 与对象）
Puma → PostgreSQL（更新 MR 状态为 merged）
Sidekiq（关闭关联 Issue、删除源分支、触发部署流水线）
```

### 6.4 流程图

```text
┌───────────┐  点击 Merge   ┌───────────┐  merge  ┌────────┐
│ Maintainer │ ───────────▶ │ Puma/Rails │ ──────▶ │ Gitaly │
└───────────┘               └─────┬─────┘         └────────┘
                                  │ 更新状态
                                  ▼
                          ┌────────────┐
                          │ PostgreSQL │  ← MR 状态 = merged
                          └─────┬──────┘
                                │ 入队
                                ▼
                          ┌───────────┐
                          │  Sidekiq  │  ← 关闭 Issue、删分支、触发部署
                          └───────────┘
```

---

## 七、阶段六：部署与版本发布

### 7.1 说明

合并到主线后，若配置了 CD，会触发部署流水线将应用部署到目标环境；随后打 Tag 并创建 Release，形成可追溯的版本。

### 7.2 关键操作

```bash
# 打版本标签
git tag v1.0.0
git push origin v1.0.0
```

- 在 Release 页面创建 Release，填写版本说明、关联里程碑、附上发布资产（构建产物、镜像等）。

### 7.3 涉及模块与数据流

```text
合并触发 → Sidekiq → Runner（部署 job）→ Environment 更新（dev/staging/prod）
→ 打 Tag（Gitaly 记录）→ 创建 Release（PostgreSQL 记录）
→ 构建镜像推送到 Container Registry / 包上传到 Package Registry
```

### 7.4 流程图

```text
主线更新（合并完成）
   │
   ▼
┌───────────┐  部署 job  ┌──────────────┐  部署  ┌──────────────┐
│  Sidekiq  │ ─────────▶ │ GitLab Runner │ ─────▶ │ Environment   │
└───────────┘            └──────────────┘        └──────┬───────┘
                                                         │ 成功后
                                                         ▼
                                                  ┌──────────────┐
                                                  │ 打 Tag (Gitaly)│
                                                  └──────┬───────┘
                                                         ▼
                                                  ┌──────────────┐
                                                  │ 创建 Release  │ ──▶ PostgreSQL
                                                  └──────┬───────┘
                                                         │ 发布资产
                                                         ▼
                                          Container Registry / Package Registry
```

---

## 八、端到端总览图

```text
客户端编辑 → 提交 → push → 创建 MR → CI 验证 ─┐
                                              ├─▶ 代码评审 ─▶ 合并主线 ─▶ 部署 ─▶ 打 Tag/Release
                                              │
                                          (不通过则回到编辑)
```

> 整个流程以 **Gitaly（仓库）** 与 **PostgreSQL（元数据）** 为数据底座，**Redis（缓存/队列）** 与 **Sidekiq（异步）** 为加速与调度层，**Runner** 为 CI/CD 执行者，**Workhorse/Puma** 为接入层。

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [GitLab 架构与 IO 流程]({{< ref "architecture" >}})。
