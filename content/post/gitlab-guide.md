+++
title = "GitLab 运维指南（总览）"
date = 2025-03-25T10:05:00+08:00
draft = false
author = ""
keywords = ["gitlab", "devops", "选型", "omnibus", "docker", "kubernetes", "redmine"]
summary = "GitLab 运维指南的主文档：整体介绍 GitLab、平台选型与部署方式总览，并按模块引导到架构、功能、IO 流程及各分文档。"
tags = ["gitlab", "devops", "overview"]
+++

# GitLab 运维指南（总览）

本文档是 GitLab CE（社区版）运维系列文档的**主文档**。第一章整体介绍 GitLab 的组件与架构；第二章做平台选型对比；第三章引导至架构与 IO 流程、功能全景、Merge Request 全流程与进阶高级功能四个独立文档；第四章按部署方式、组件配置、备份恢复、数据迁移与平台使用展开，其中「成体系」的模块被拆分为独立文档，本文以引用（`ref`）的方式引导到对应分文档。

> 本文所有示例中的域名、密码、令牌、IP 等均为占位符或示例值，实际使用请替换为你自己的环境信息。

<!--more-->

---

## 第一章 GitLab 概述

### 1.1 GitLab 是什么

GitLab 是一个**一体化的 DevOps 平台**，远不止是代码托管（Git 仓库），更提供了贯穿软件开发生命周期的全套工具，包括内置的 CI/CD、问题跟踪（Issue）、Wiki、容器镜像仓库（Container Registry）等。团队可以在一个平台上完成从规划、编码、构建、测试到部署的全部工作。

GitLab 发行版主要有两个：

| 版本 | 说明 |
| --- | --- |
| **GitLab CE**（Community Edition） | 社区版，开源免费，满足绝大多数私有化部署需求 |
| **GitLab EE**（Enterprise Edition） | 企业版，额外提供高级搜索（Advanced Search）、合规、精细审计等功能，部分需付费许可证 |

> 本文档以 **CE 版**为对象。注意：内置的高级搜索（基于 Elasticsearch）、以及部分高级功能仅 EE 提供。CE 可通过 Zoekt 补充代码搜索、通过 API + 外部 Elasticsearch 做数据导出分析，但无法完全替代 EE 的内置搜索。

### 1.2 GitLab 的核心组件

| 组件 | 作用 |
| --- | --- |
| **Puma / Webservice** | 处理前端同步 HTTP 请求的 Web 服务 |
| **Sidekiq** | 后台异步任务处理器（如邮件、CI 调度） |
| **Gitaly** | Git 仓库的专用 RPC 存储服务 |
| **GitLab Workhorse** | 反向代理与大文件上传处理 |
| **PostgreSQL** | 关系型数据库，存储用户、项目、Issue 等元数据 |
| **Redis** | 缓存、队列、会话等 |
| **Nginx** | 内置反向代理 / Web 服务器 |
| **Container Registry** | 内置容器镜像仓库 |
| **GitLab Runner** | 执行 CI/CD Job 的执行器 |
| **Prometheus** | 内置监控（时序数据） |

> 组件之间的请求流转关系与完整架构图见 [GitLab 架构]({{< ref "/gitlab/architecture" >}})。

### 1.3 部署方式总览

GitLab 支持多种部署方式，本指南按部署方式组织安装/备份/恢复章节：

| 部署方式 | 简称 | 特点 | 文档 |
| --- | --- | --- | --- |
| **Omnibus**（Linux 包安装） | gitlab-omnibus | 传统单机/裸机安装，使用共享存储，需协调各部件资源 | [安装 · Omnibus]({{< ref "/gitlab/install-omnibus" >}}) |
| **Docker**（容器部署） | gitlab-docker | 保证数据持久化与端口映射，需关注前后端网络连通 | [安装 · Docker]({{< ref "/gitlab/install-docker" >}}) |
| **Kubernetes**（Helm Chart） | gitlab-k8s | 使用 Ingress/LoadBalancer 路由；官方 chart 方案要求 Gitaly 与数据库使用裸机/独立集群提供资源 | [安装 · Kubernetes]({{< ref "/gitlab/install-k8s" >}}) |

选择建议：

- 小团队、单机起步 → Omnibus 或 Docker。
- 需要弹性扩展、与容器平台统一管理 → Kubernetes（但复杂度最高，存储与数据库需单独规划）。

---

## 第二章 平台选型

### 2.1 代码管理平台选型

| 维度 | SVN | GitLab | SCM-Manager |
| --- | --- | --- | --- |
| 核心架构 | 集中式版本控制 | 基于 Git 的一体化 DevOps 平台 | 统一管理 Git/SVN/Mercurial 的轻量仓库管理 |
| 主要功能 | 文件/目录版本控制、原子提交，不支持离线 | 代码托管、CI/CD、Issue、Wiki、容器仓库，支持离线 | 仓库管理、用户/权限管理、REST API，不支持离线 |
| 权限管理 | 路径级权限控制 | 精细权限控制（仓库/分支/目录级） | 精细权限控制 |
| 适用场景 | 老项目、简单协作 | 现代软件团队、追求高效 DevOps 流程 | 需要同时管理多种 VCS 的团队 |

选择 GitLab 的理由：功能丰富、一体化、支持精细权限与代码审查流程，是私有化 DevOps 平台的常见首选。

### 2.2 缺陷跟踪（Issue）系统选型

| 维度 | Bugzilla | Jira | Redmine | 禅道 |
| --- | --- | --- | --- | --- |
| 类型 | 经典开源 | 商业软件 | 灵活开源 | 国产一体化 |
| 特点 | 稳定、可定制 | 工作流高度可定制、插件丰富 | 多项目管理、集成 Wiki/甘特图 | 需求-用例-缺陷全生命周期 |
| 适用 | 中小团队、开源项目 | 中大型企业、复杂流程 | 中小团队、需免费方案 | 符合国内流程习惯 |

选择 Redmine 的理由：开源免费、支持多项目与子项目、问题跟踪可自定义工作流与字段、集成 Wiki/论坛/甘特图，适合作为编码项目的问题单库与 GitLab 配合使用。

---

## 第三章 架构、功能与流程

GitLab 的架构、功能全景与 IO 流程拆分为三个独立文档：

| 主题 | 说明 | 文档 |
| --- | --- | --- |
| 架构与 IO 流程 | 组件架构图、数据流与各类功能的管理/业务流程 | [GitLab 架构与 IO 流程]({{< ref "/gitlab/architecture" >}}) |
| 功能全景与版本沿革 | 全部功能分类与主要功能引入版本 | [功能全景与版本沿革]({{< ref "/gitlab/features" >}}) |
| Merge Request 全流程 | 从编辑提交到合并发布的完整业务流 | [Merge Request 全流程]({{< ref "/gitlab/merge-request" >}}) |
| 进阶：高可用与高级功能 | 数据库高可用、Gitaly Raft、ES 替代、模板仓库 | [GitLab 进阶]({{< ref "/gitlab/advanced" >}}) |

---

## 第四章 各模块引导

| 模块 | 说明 | 文档 |
| --- | --- | --- |
| 安装 · Omnibus | Linux 包安装、主机环境准备 | [安装 · Omnibus]({{< ref "/gitlab/install-omnibus" >}}) |
| 安装 · Docker | 容器部署、数据持久化、外部数据库 | [安装 · Docker]({{< ref "/gitlab/install-docker" >}}) |
| 安装 · Kubernetes | Helm Chart、Ceph/对象存储、外部 Postgres/Redis、Runner、KAS | [安装 · Kubernetes]({{< ref "/gitlab/install-k8s" >}}) |
| 组件与集成配置 | 数据库、LDAP/AD、SMTP、Gravatar、SSH、注册、遥测、Pages | [组件与集成配置]({{< ref "/gitlab/configuration" >}}) |
| 数据备份 | 备份概念、各部署方式备份、定时任务 | [数据备份]({{< ref "/gitlab/backup" >}}) |
| 数据恢复 | 各部署方式恢复、Secrets 处理、密码登录恢复 | [数据恢复]({{< ref "/gitlab/recover" >}}) |
| 数据迁移 | 存储迁移、SVN 迁移、项目导入、镜像仓库 | [数据迁移与项目导入]({{< ref "/gitlab/migrate" >}}) |
| 平台使用 | 组/项目、角色权限、镜像同步、Redmine 集成、CI/CD | [平台使用与 Redmine 集成]({{< ref "/gitlab/platform-usage" >}}) |

---

## 附录：文档导航

本指南包含以下文档：主文档（本文）位于 `content/post/`，其余分文档位于 `content/gitlab/` 目录下：

| 文档 | 路径 | 内容 |
| --- | --- | --- |
| **总览（本文）** | [`post/gitlab-guide.md`]({{< ref "/post/gitlab-guide" >}}) | 整体介绍 + 平台选型 + 部署方式总览 |
| 分区首页 | [`gitlab/_index.md`]({{< ref "/gitlab" >}}) | 系列总目录 |
| 架构与 IO 流程 | [`gitlab/architecture.md`]({{< ref "/gitlab/architecture" >}}) | 架构图、数据流与管理/业务流程 |
| 功能全景与版本沿革 | [`gitlab/features.md`]({{< ref "/gitlab/features" >}}) | 全部功能与版本沿革 |
| Merge Request 全流程 | [`gitlab/merge-request.md`]({{< ref "/gitlab/merge-request" >}}) | 从编辑提交到合并发布 |
| 进阶：高可用与高级功能 | [`gitlab/advanced.md`]({{< ref "/gitlab/advanced" >}}) | 数据库高可用/Raft/ES/模板仓库 |
| 安装 · Omnibus | [`gitlab/install-omnibus.md`]({{< ref "/gitlab/install-omnibus" >}}) | Omnibus 部署安装 |
| 安装 · Docker | [`gitlab/install-docker.md`]({{< ref "/gitlab/install-docker" >}}) | Docker 部署安装 |
| 安装 · Kubernetes | [`gitlab/install-k8s.md`]({{< ref "/gitlab/install-k8s" >}}) | K8s 部署安装 |
| 组件与集成配置 | [`gitlab/configuration.md`]({{< ref "/gitlab/configuration" >}}) | 数据库/LDAP/SMTP 等配置 |
| 数据备份 | [`gitlab/backup.md`]({{< ref "/gitlab/backup" >}}) | 备份方案 |
| 数据恢复 | [`gitlab/recover.md`]({{< ref "/gitlab/recover" >}}) | 恢复流程 |
| 数据迁移 | [`gitlab/migrate.md`]({{< ref "/gitlab/migrate" >}}) | 迁移与导入 |
| 平台使用 | [`gitlab/platform-usage.md`]({{< ref "/gitlab/platform-usage" >}}) | 组/项目/权限/Redmine |

建议按「架构/功能 → 安装 → 配置 → 备份/恢复 → 迁移 → 平台使用」的顺序阅读。
