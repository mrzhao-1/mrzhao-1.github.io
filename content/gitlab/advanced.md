+++
title = "GitLab 进阶：高可用与高级功能"
date = 2025-03-24T10:05:00+08:00
draft = false
author = ""
keywords = ["gitlab", "高可用", "gitaly raft", "elasticsearch", "模板仓库", "pgpool", "citus"]
summary = "GitLab 的数据库高可用架构、Gitaly Raft 集群、Elasticsearch 集成与 CE 替代方案、镜像与模板仓库管理。"
tags = ["gitlab", "ha", "advanced"]
+++

# GitLab 进阶：高可用与高级功能

本文介绍 GitLab 的进阶主题：数据库高可用架构、Gitaly Raft 集群、Elasticsearch 集成与 CE 替代方案、镜像与模板仓库管理，是 [总览]({{< ref "/post/gitlab-guide" >}}) 中「高级功能」模块的展开。

<!--more-->

---

## 一、数据库高可用架构

GitLab 使用外部 PostgreSQL 时，可搭建主从高可用集群。常见架构如下：

```text
应用（GitLab / Redmine）
        │
        ▼
┌─────────────────────────────┐
│  Haproxy + Keepalived (VIP)  │  ← 负载均衡与虚拟 IP 漂移
└──────────────┬──────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
  ┌──────────┐  ┌──────────┐
  │ Pgpool-II │  │ Pgpool-II │   ← 连接池 + 读写分离（备）
  └─────┬────┘  └─────┬────┘
        │             │
        ▼             ▼
┌───────────────────────────────┐
│  PostgreSQL 主从集群            │
│  coord 节点（提供本地数据库服务） │
│  worker 节点（预留分布式扩展）    │
│  replication 同步到从节点        │
└───────────────────────────────┘
```

要点：

- **coord 节点**向前端业务流提供本地数据库服务，**worker 节点**预留分布式数据库（citus）扩展能力，后续可按需平滑切换到分布式。
- 主从使用 **replication** 模式同步，部分从节点损坏不影响前端服务。
- **pgpool-II** 中间件提供连接池与读写分离，配合 **Haproxy + Keepalived** 实现高可用与 VIP 漂移。

> 该架构来自「GitLab + Redmine 平台搭建」的数据库层设计，适用于对外部 PostgreSQL 有高可用与水平扩展诉求的场景。

---

## 二、Gitaly Raft 集群

Gitaly 的 Raft 集群在生产环境中被官方定义为 **Limited Availability（有限可用）**，成熟里程碑是转为 **Generally Available（GA）**。按 GitLab 规划，预计在 **FY27Q1** 完成此转变（在此之前于 FY26Q4 完成内部 Dogfooding 测试）。

升级/迁移注意事项：

- **版本路径**：升级必须遵循官方支持路径，**不能跳过主版本**（例如不能从 17.x 直接升到 19.x，需经过 18.x）。
- **组件升级顺序**：升级应用服务器前，必须先升级所有 Gitaly 节点，否则新旧 gRPC 协议不兼容会导致调用失败。
- **数据备份**：任何升级前必须完整备份。
- **Raft 特殊风险**：Raft 架构**不支持快照备份**，给数据恢复带来额外复杂性。
- **零停机**：建议使用「迁移仓库」的升级方式；若原地升级，迁移过程中每个仓库会短暂只读，需提前规划业务窗口。

---

## 三、Elasticsearch 集成与 CE 替代方案

GitLab 与 Elasticsearch 的集成为「高级搜索（Advanced Search）」，可显著提升代码/Issue/MR 的搜索性能，但**需要 Premium/Ultimate 许可证**，CE 不可用。

CE 的替代方案：

| 方案 | 说明 | 局限 |
| --- | --- | --- |
| **Zoekt** | 开源代码搜索引擎，支持精确匹配与正则 | 仅代码搜索，不能搜 Issue/MR 等 |
| **CloudQuery** | 开源数据集成平台，将 GitLab 数据同步到 ES 等目标 | 用于外部分析/仪表盘，不替换内置搜索 |
| **API + 自建索引** | 用 REST/GraphQL API 拉取数据，自行写入 ES | 需自行开发脚本 |

建议：CE 用 **Zoekt** 补充代码搜索；如需对 Issue/用户/项目元数据做分析，用 **CloudQuery** 或 API 导出到外部 Elasticsearch。

---

## 四、镜像与模板仓库

对于 VM 模板、系统镜像等**几十 GB 的二进制大文件**（.iso/.qcow2/.ova），有三种管理方案：

| 方案 | 说明 | 适用 |
| --- | --- | --- |
| **Generic Package Repository**（推荐） | 专用二进制制品仓库，支持版本控制、按需流式下载 | 大文件安全高效存储与检索 |
| **Releases** | 版本发布资产，可视化版本归档 | 面向用户展示版本与下载 |
| **Git LFS** | 用文本指针替代大文件 | 需与代码紧密耦合、版本迭代频繁 |

推荐路径：**以 Generic Package Repository 为仓库、以 Releases 为展示窗口**。

上传模板文件到 Generic Package Repository：

```bash
curl --header "PRIVATE-TOKEN: <your_access_token>" \
     --upload-file /path/to/template.ova \
     "https://gitlab.example.com/api/v4/projects/<project_id>/packages/generic/my_vm_template/1.0.0/template.ova"
```

然后在 Releases 页面创建发布并关联该包的下载链接，用户即可按版本下载模板。

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航。
