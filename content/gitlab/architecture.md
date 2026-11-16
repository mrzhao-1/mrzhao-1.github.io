+++
title = "GitLab 架构与 IO 流程"
date = 2025-03-24T10:01:00+08:00
draft = false
author = ""
keywords = ["gitlab", "架构", "architecture", "组件", "数据流", "流程", "io"]
summary = "GitLab 的组件架构图、各类请求（HTTP/SSH/异步/静态站点）的数据流转路径，以及各类功能的管理/业务 IO 流程。"
tags = ["gitlab", "architecture", "workflow", "io"]
+++

# GitLab 架构与 IO 流程

本文介绍 GitLab 的组件架构、数据流，以及各类功能的管理/业务 IO 流程，是 [总览]({{< ref "/post/gitlab-guide" >}}) 中「架构」与「IO 流程」模块的展开。

<!--more-->

---

## 一、组件职责

| 组件 | 作用 |
| --- | --- |
| **Puma / Webservice** | 处理前端同步 HTTP 请求的 Rails Web 服务 |
| **Sidekiq** | 后台异步任务处理器（如邮件、CI 调度） |
| **Gitaly** | Git 仓库的专用 RPC 存储服务 |
| **GitLab Workhorse** | Go 实现的反向代理，处理大文件上传/下载 |
| **GitLab Shell** | 处理 SSH 会话，桥接 OpenSSH 与 Gitaly |
| **PostgreSQL** | 关系型数据库，存储用户、项目、Issue 等元数据 |
| **Redis** | 缓存、队列、会话 |
| **Nginx / 负载均衡** | 反向代理与流量分发 |
| **Container Registry** | 容器镜像仓库 |
| **GitLab Runner** | 执行 CI/CD Job 的执行器 |
| **Prometheus** | 内置监控（时序数据） |

---

## 二、组件架构图

```text
                              HTTP/HTTPS (80/443)
                                     │
                                     ▼
                          ┌───────────────────┐
                          │   负载均衡 / Nginx  │
                          └─────────┬─────────┘
                                    │
              ┌─────────────────────┼──────────────────────┐
              ▼                     ▼                      ▼
   ┌───────────────────┐  ┌─────────────────┐   ┌─────────────────┐
   │  GitLab Workhorse  │  │  GitLab Pages   │   │   SSH (22)      │
   │  (Go 反向代理)      │  │  (静态站点托管)  │   │  GitLab Shell   │
   └──┬──────┬──────┬───┘  └─────────────────┘   └────────┬────────┘
      │      │      │                                     │
      ▼      ▼      ▼                                     ▼
 ┌───────┐┌─────┐┌────────┐                        ┌──────────┐
 │ Puma  ││Redis││ Gitaly │◄───────────────────────│  Gitaly  │
 │(Rails)││缓存  ││(Git仓库)│                        │ (Git仓库) │
 └─┬───┬─┘└──┬──┘└────────┘                        └──────────┘
   │   │     │
   │   │     ▼
   │   │ ┌─────────┐
   │   │ │ Sidekiq │   ← 从 Redis 拉取异步任务
   │   │ └────┬────┘
   ▼   ▼      ▼
 ┌──────────────┐
 │  PostgreSQL   │
 └──────────────┘
```

---

## 三、数据流说明

| 请求类型 | 流转路径 |
| --- | --- |
| Web UI / API（HTTP） | Nginx → Workhorse → Puma → PostgreSQL / Redis / Gitaly |
| Git HTTP（clone/push） | Nginx → Workhorse → Gitaly |
| Git SSH（clone/push） | SSH → GitLab Shell → Gitaly |
| 大文件上传/下载 | Workhorse 直接处理（绕过 Rails，提升性能） |
| 异步任务（邮件、CI 调度等） | Sidekiq 从 Redis 队列拉取 → 写 PostgreSQL |
| 静态站点（Pages） | Nginx → GitLab Pages |

> 说明：Git LFS 主要由 Puma（Rails）处理，而非 Gitaly；Dependency Proxy 由 Puma 处理，而非 Container Registry。

---

## 四、管理与业务 IO 流程

### 4.1 概念：管理 IO 与业务 IO

- **管理 IO（Management I/O）**：由**管理员/项目 Owner** 触发的配置、审批、权限与治理类操作，通常是低频、面向「平台维护」。
- **业务 IO（Business I/O）**：由**开发/测试/运维等终端用户** 触发的日常研发协作操作，通常是高频、面向「价值交付」。

下面按主要功能类别给出两类流程的典型场景。

### 4.2 代码托管与合并请求（MR）

**管理 IO —— 项目初始化与治理**：

```text
创建组/子组 → 创建项目 → 配置可见性(Private/Internal/Public)
   → 添加成员并分配角色 → 配置保护分支规则 → 配置 Code Owners
   → 配置推送规则/批准规则
```

**业务 IO —— 日常开发与代码评审**：

```text
clone 仓库 → 创建 feature 分支 → 本地提交 push
   → 创建 Merge Request → CI 自动触发 → 代码评审(评论/建议)
   → 通过后合并(Merge) → 触发部署流水线 → 关闭 MR
```

### 4.3 CI/CD

**管理 IO —— 流水线平台配置**：

```text
注册 Runner(选择 executor) → 配置 Runner 标签与并发
   → 设置 CI/CD 变量(密钥/环境) → 配置受保护变量与分支
   → 配置缓存(S3)与产物策略
```

**业务 IO —— 触发与执行流水线**：

```text
push 代码 → 解析 .gitlab-ci.yml → 按 stage 调度 Job
   → Runner 拉取 Job 并执行 → 产出 artifacts/报告
   → 状态回传并更新 MR/Pipeline UI
```

### 4.4 规划（Issue / Board）

**管理 IO —— 工作流配置**：

```text
创建标签 → 创建里程碑 → 创建 Issue Board(多列表)
   → 配置 Issue 模板 → 配置权重/健康状态(EE)
```

**业务 IO —— 问题跟踪**：

```text
创建 Issue → 打标签/指派/设置里程碑 → 拖拽到对应 Board 列表
   → 关联 MR → MR 合并后自动关闭 Issue → 关闭里程碑
```

### 4.5 包管理与镜像仓库

**管理 IO —— 仓库开通**：

```text
启用 Container Registry → 启用/配置 Package Registry
   → 设置仓库可见性 → 配置访问令牌/Deploy Token → 配置清理策略
```

**业务 IO —— 发布与消费制品**：

```text
CI 构建镜像/包 → docker push / package 上传 → 制品入库
   → 部署时 docker pull / 依赖拉取 → 按保留策略清理旧版本
```

### 4.6 发布与部署（Environment / Release）

**管理 IO —— 环境配置**：

```text
定义环境(dev/staging/prod) → 配置部署变量
   → 配置审批/受保护环境 → 配置回滚策略
```

**业务 IO —— 部署交付**：

```text
代码合并 → 部署流水线执行 → 更新 Environment
   → Review App(按 MR 临时环境) → 验收 → 创建 Release → 回滚(如需)
```

### 4.7 安全扫描（Secure）

**管理 IO —— 策略配置**：

```text
启用安全扫描模板 → 配置扫描策略与阈值 → 配置漏洞告警
```

**业务 IO —— 扫描与修复**：

```text
CI 触发 SAST/DAST/依赖扫描 → 产出漏洞报告
   → 漏洞进入漏洞管理 → 创建修复 MR → 复扫验证关闭
```

### 4.8 认证与权限（LDAP/SSO）

**管理 IO —— 认证源配置**：

```text
配置 LDAP/AD 或 SAML/OIDC → 设置同步与自动创建策略
   → 配置默认角色 → 配置双因素认证
```

**业务 IO —— 登录与访问**：

```text
访问 GitLab → 跳转认证源 → 认证通过 → 按组/项目角色授权
   → 进入项目操作
```

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [功能全景与版本沿革]({{< ref "features" >}})。
