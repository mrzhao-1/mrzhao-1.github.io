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

## 安装过程

待补充

## 组件配置

待补充

## 历史备份

待补充

## 历史备份恢复

根据目前 gitlab 的架构和部署方式发展，对不同环境进行的恢复过程

- docker部署的 gitlab-ce (简称为 gitlab-docker )

- k8s 部署的 gitlab-ce (简称为 gitlab-k8s )


按照不同的 gitlab 部署方式，对 gitlab 进行数据迁移或恢复

### （一） docker部署的 gitlab-ce (简称为 gitlab-docker ) 数据恢复

从旧的 gitlab 环境中提取全量备份文件，在 gitlab-docker 环境中恢复数据：[关于 gitlab-docker 数据恢复细节](/gitlab/recover-to-docker/)

### （二） k8s 部署的 gitlab-ce (简称为 gitlab-k8s ) 数据恢复

从旧的 gitlab 环境中提取全量备份文件，在 gitlab-k8s 环境中恢复数据：[关于 gitlab-k8s 数据恢复细节](/gitlab/recover-to-k8s/)