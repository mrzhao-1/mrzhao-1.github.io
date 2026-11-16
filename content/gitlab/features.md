+++
title = "GitLab 功能全景与版本沿革"
date = 2025-03-24T10:02:00+08:00
draft = false
author = ""
keywords = ["gitlab", "功能", "features", "版本", "version", "devops"]
summary = "GitLab 的全部功能全景图（按 DevOps 阶段分类）与主要功能的版本沿革。"
tags = ["gitlab", "features", "version"]
+++

# GitLab 功能全景与版本沿革

本文给出 GitLab 的功能全景图（按 DevOps 阶段分类，标注 CE/EE）与主要功能的版本沿革，是 [总览]({{< ref "/post/gitlab-guide" >}}) 中「功能全景」模块的展开。

<!--more-->

---

## 一、功能全景图

GitLab 的功能覆盖 DevOps 全生命周期，按阶段分类如下（CE = 社区版可用，EE = 仅企业版）：

| 阶段 | 功能 | 说明 | 版本 |
| --- | --- | --- | --- |
| **管理 Manage** | 用户 / 组 / 子组 / 项目 | 组织与命名空间，精细权限模型（Guest/Reporter/Developer/Maintainer/Owner） | CE |
| | 认证与 SSO | LDAP / AD、SAML、OIDC、双因素认证 | CE（部分 EE） |
| | 审计事件 | 记录关键操作，便于合规审计 | CE（高级审计 EE） |
| | 推送规则 / 导入导出 | 仓库推送限制、项目导入导出与迁移 | CE |
| **规划 Plan** | Issue | 问题跟踪，可关联 MR、标签、里程碑 | CE |
| | Issue Board | 看板式管理，支持多列表与泳道 | CE |
| | 里程碑 / 标签 | 版本里程碑、标签分类 | CE |
| | Wiki / Snippets | 项目文档、代码片段 | CE |
| | Epic / Roadmap | 跨项目史诗与路线图 | EE（Ultimate） |
| | Design Management | 设计稿版本管理与评审 | CE |
| **创建 Create** | 仓库 + MR | 代码托管、合并请求、代码评审（diff、建议、多级评审） | CE |
| | 保护分支 / 受保护标签 | 精细控制谁可 push/merge | CE |
| | Code Owners | 指定文件/路径的责任人 | CE |
| | Web IDE / Git LFS | 在线编辑、大文件存储 | CE |
| | 代码搜索（Zoekt/高级搜索） | 代码全文检索（高级搜索 EE） | CE（Zoekt）/ EE |
| **验证 Verify** | CI/CD 流水线 | `.gitlab-ci.yml` 驱动，多阶段、并行、依赖 | CE |
| | GitLab Runner | 执行 Job 的执行器 | CE |
| | 测试报告 / 代码覆盖率 | 可视化测试结果与覆盖率 | CE |
| | Code Quality | 代码质量扫描 | CE |
| | Review Apps | 为 MR 部署临时环境 | CE |
| **打包 Package** | 包仓库（Package Registry） | Maven/npm/PyPI/NuGet/Composer/Conan/RubyGems/Helm | CE |
| | 容器镜像仓库（Container Registry） | 存储/分发 Docker 镜像 | CE |
| | 依赖代理（Dependency Proxy） | 缓存上游镜像，加速拉取 | CE |
| **发布 Release** | 环境 / 部署 | 环境管理与部署记录、回滚 | CE |
| | Releases | 版本发布、发布说明与资产 | CE |
| | Feature Flags | 特性开关 | CE |
| | GitLab Pages | 发布静态站点 | CE |
| **安全 Secure** | SAST / DAST / 依赖扫描 / 密钥检测 / 容器扫描 | 应用安全扫描 | CE（部分 Ultimate） |
| | 漏洞管理 | 聚合扫描结果、漏洞追踪 | CE |
| **监控 Monitor** | 指标 / 日志 / 追踪 / 错误追踪 / 告警 | 应用监控与告警 | CE |
| **平台能力** | REST / GraphQL API、Webhook、集成 | 扩展与自动化 | CE |
| | 备份 / 恢复、Geo 容灾 | 数据备份恢复、异地容灾 | CE（Geo EE） |

---

## 二、功能版本沿革

> 注意：GitLab 每月发布一个小版本，以下「引入版本」为主要功能的**近似引入版本**（部分取自官方发布说明与社区资料，Auto DevOps 为 11.0）。精确的引入与「稳定/GA」状态请以 [GitLab 官方 Release 说明](https://about.gitlab.com/releases/) 为准。GitLab 对功能用 experimental → beta → generally available 的状态标识，而非单一版本号。

| 功能 | 引入版本 | 说明 |
| --- | --- | --- |
| Issue / Merge Request / Wiki / Snippet | 1.x–4.x（2011–2013） | 早期即为核心功能 |
| 内置 CI/CD | 8.0（2015） | CI 从独立项目并入核心 |
| Git LFS | 8.2 | 大文件存储 |
| GitLab Pages | 8.3 | 静态站点发布 |
| Container Registry | 8.8 | 容器镜像仓库 |
| Environments | 8.9 | 环境与部署管理 |
| Code Owners | 8.17 | 文件责任人 |
| 子组 / 组里程碑 | 9.0 | 嵌套命名空间 |
| Web IDE | 10.4 | 在线编辑器 |
| Auto DevOps | 11.0 | 一键流水线 |
| Package Registry | 11.3 | 包仓库 |
| Secret Detection | 11.5 | 密钥检测 |
| Dependency Proxy | 11.11 | 镜像代理缓存 |
| Design Management | 12.2 | 设计稿管理 |
| Terraform State | 12.6 | IaC 状态管理 |
| Pipeline Editor | 12.10 | 可视化流水线编辑器 |
| GitLab Agent（KAS） | 13.4 | Kubernetes 连接代理 |
| Epic（Ultimate） | 10.2 | 跨项目史诗 |

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [GitLab 架构与 IO 流程]({{< ref "architecture" >}})。
