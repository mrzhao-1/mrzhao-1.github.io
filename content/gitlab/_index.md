+++
title = "GitLab 运维指南"
date = 2025-03-24T10:00:00+08:00
draft = false
author = ""
keywords = ["gitlab", "devops", "运维", "ce", "部署", "备份", "恢复"]
summary = "GitLab CE 运维系列文档的总目录，涵盖平台选型、多种部署方式、组件配置、备份恢复、数据迁移与平台使用。"
tags = ["gitlab", "devops", "运维"]
+++

# GitLab 运维指南

这里是 GitLab CE（社区版）运维系列文档的总目录。整体介绍与各模块入口见 [总览与主文档]({{< ref "/post/gitlab-guide" >}})。

各分文档：

- [总览与主文档]({{< ref "/post/gitlab-guide" >}}) —— 整体介绍 GitLab、平台选型与部署方式总览。
- [架构与 IO 流程]({{< ref "architecture" >}}) —— 组件架构图、数据流与管理/业务流程。
- [功能全景与版本沿革]({{< ref "features" >}}) —— 全部功能分类与版本沿革。
- [Merge Request 全流程]({{< ref "merge-request" >}}) —— 从编辑提交到合并发布的完整业务流。
- [安装 · Omnibus 部署]({{< ref "install-omnibus" >}}) —— 传统 Linux 包安装方式。
- [安装 · Docker 部署]({{< ref "install-docker" >}}) —— 容器环境部署与数据持久化。
- [安装 · Kubernetes 部署]({{< ref "install-k8s" >}}) —— Helm Chart + 对象存储 + 外部服务。
- [组件与集成配置]({{< ref "configuration" >}}) —— 数据库、LDAP、SMTP、Gravatar、SSH、注册等。
- [数据备份]({{< ref "backup" >}}) —— 按部署方式的备份方案与定时任务。
- [数据恢复]({{< ref "recover" >}}) —— 按部署方式的恢复流程与 Secrets 处理。
- [数据迁移与项目导入]({{< ref "migrate" >}}) —— 存储迁移、SVN 迁移与项目导入。
- [平台使用与 Redmine 集成]({{< ref "platform-usage" >}}) —— 组/项目、角色权限、镜像同步与缺陷跟踪集成。

> 说明：github-style 主题的 `list.html` 只渲染子页面列表，不渲染本页正文。完整的「主文档」内容请阅读 [总览与主文档]({{< ref "/post/gitlab-guide" >}})。
