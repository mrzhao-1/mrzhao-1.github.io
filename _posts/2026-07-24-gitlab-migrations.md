---
title: "GitLab：一体化 DevOps 平台"
date: 2025-10-10
categories:
  - notes
tags:
  - 随笔
---

本系列讲解gitlab-ce维护的详细过程和遇到的各种问题。

## 概述

gitlab支持多种安装方式，包括：

Omnibus （注1）部署方式（传统 Linux 包安装，简称 gitlab-omnibus），可以使用裸机资源和共享存储来进行环境配置，需要注意各部件协调和资源合理安排。

从 docker 环境中部署 gitlab-ce （本系列文档中简称为 gitlab-docker）,关键在于保证数据持久化和端口映射，确保前后端网络连通。如果有外置资源安排，需要确认各部件容器协调。

k8s 环境中部署 gitlab-ce （本系列文档中简称为 gitlab-k8s）,使用 ingress 或 loadBalance 进行路由，协调各部件的流量。同时，在常规的gitlab chart部署方案中，要求 gitaly 和 数据库 使用裸机集群的方式提供资源。

## 安装过程

待归档

## 组件配置

待归档

## 历史备份

对不同的部署方式进行的备份方案：

根据目前 gitlab 的架构和部署方式发展，对不同环境进行的恢复过程

gitlab 备份：[关于 gitlab 数据备份细节](/gitlab/backup/)


## 历史备份恢复


按照不同的 gitlab 部署方式，对 gitlab 进行数据迁移或恢复

### （一） docker部署的 gitlab-ce (简称为 gitlab-docker ) 数据恢复

- 从旧的 gitlab 环境中提取全量备份文件，在 gitlab-docker 环境中恢复数据：[关于 gitlab-docker 数据恢复细节](/gitlab/recover-to-docker/)

### （二） k8s 部署的 gitlab-ce (简称为 gitlab-k8s ) 数据恢复

- 从旧的 gitlab 环境中提取全量备份文件，在 gitlab-k8s 环境中恢复数据：[关于 gitlab-k8s 数据恢复细节](/gitlab/recover-to-k8s/)


注1：“Omnibus” 来自拉丁语，意思是 “给所有人 / 为所有人”，是 omnis（所有）的与格复数。英语里借过来后，核心含义是 “综合的、包含多项内容的”。