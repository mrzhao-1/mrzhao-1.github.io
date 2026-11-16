+++
title = "Kubernetes 运维指南（总览）"
date = 2026-11-08T10:00:00+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "安装", "二进制安装", "证书", "高可用", "kubeadm"]
summary = "Kubernetes 运维指南的主文档：整体介绍 K8s 架构与两种安装方式，并按模块引导到各分文档。"
tags = ["k8s", "kubernetes", "overview"]
+++

# Kubernetes 运维指南（总览）

本文档是 Kubernetes 运维系列文档的**主文档**。第一章整体介绍 Kubernetes 架构与两种安装方式；后续各章按「基础环境 → 二进制安装 → 组件配置 → 高可用 → 迁移 → 插件 → 容器化安装」展开，各分文档是独立的过程/配置文档，本文以引用（`ref`）的方式引导。

<!--more-->

---

## 第一章 Kubernetes 概述

### 1.1 控制面组件

| 组件 | 作用 |
| --- | --- |
| **kube-apiserver** | 集群统一入口，所有 REST 操作都经过它 |
| **etcd** | 分布式键值存储，保存集群所有配置与状态 |
| **kube-controller-manager** | 运行各种控制器，维持期望状态 |
| **kube-scheduler** | 负责 Pod 调度，选择合适节点 |
| **kubelet** | 每个节点上的代理，负责运行容器 |
| **kube-proxy** | 维护网络规则，实现 Service 转发 |

### 1.2 两种安装方式

| 方式 | 说明 | 文档 |
| --- | --- | --- |
| **二进制安装** | 手动下载二进制 + cfssl 生成证书 + systemd 托管各组件，可控性最强 | 本文第二~六章 |
| **容器化安装（kubeadm）** | 用 kubeadm 一键初始化，控制面组件以静态 Pod（容器）方式运行 | [容器化安装]({{< ref "/k8s/install-containerized" >}}) |

---

## 第二章 各模块引导

| 模块 | 说明 | 文档 |
| --- | --- | --- |
| 基础环境配置 | yum 源、防火墙、交换分区、网络、时间同步、ulimit、ipvsadm、内核参数 | [基础环境配置]({{< ref "/k8s/install-prerequisites" >}}) |
| 二进制安装 · 软件包与证书 | 下载二进制、cfssl 生成 etcd/k8s 各组件证书、TLS Bootstrapping | [软件包与证书]({{< ref "/k8s/install-binary" >}}) |
| 系统组件配置 | Containerd、controller-manager、scheduler、bootstrap-token | [系统组件配置]({{< ref "/k8s/install-components" >}}) |
| 高可用配置 | haproxy + keepalived 实现 apiserver VIP | [高可用配置]({{< ref "/k8s/install-ha" >}}) |
| 迁移环境配置 | 网卡 UUID、hosts、节点组件、etcd/apiserver/kubelet/kube-proxy | [迁移环境配置]({{< ref "/k8s/migration" >}}) |
| 集群插件 | 插件镜像处理与部署 | [集群插件]({{< ref "/k8s/install-plugins" >}}) |
| 容器化安装（kubeadm） | 补充的容器化安装方案 | [容器化安装]({{< ref "/k8s/install-containerized" >}}) |
| 监控与告警 | Prometheus + Alertmanager + Grafana | [监控与告警]({{< ref "/k8s/monitoring" >}}) |
| ELK 日志系统 | ECK + Filebeat + Kafka + Logstash | [ELK 日志系统]({{< ref "/k8s/elk" >}}) |

---

## 附录：文档导航

| 文档 | 路径 | 内容 |
| --- | --- | --- |
| **总览（本文）** | [`post/k8s-guide.md`]({{< ref "/post/k8s-guide" >}}) | 整体介绍 + 模块引导 |
| 分区首页 | [`k8s/_index.md`]({{< ref "/k8s" >}}) | 系列总目录 |
| 基础环境配置 | [`k8s/install-prerequisites.md`]({{< ref "/k8s/install-prerequisites" >}}) | 系统初始化 |
| 软件包与证书 | [`k8s/install-binary.md`]({{< ref "/k8s/install-binary" >}}) | 二进制 + 证书 |
| 系统组件配置 | [`k8s/install-components.md`]({{< ref "/k8s/install-components" >}}) | 组件 systemd 配置 |
| 高可用配置 | [`k8s/install-ha.md`]({{< ref "/k8s/install-ha" >}}) | haproxy/keepalived |
| 迁移环境配置 | [`k8s/migration.md`]({{< ref "/k8s/migration" >}}) | 节点迁移 |
| 集群插件 | [`k8s/install-plugins.md`]({{< ref "/k8s/install-plugins" >}}) | 插件部署 |
| 容器化安装 | [`k8s/install-containerized.md`]({{< ref "/k8s/install-containerized" >}}) | kubeadm |
| 监控与告警 | [`k8s/monitoring.md`]({{< ref "/k8s/monitoring" >}}) | Prometheus/Alertmanager/Grafana |
| ELK 日志系统 | [`k8s/elk.md`]({{< ref "/k8s/elk" >}}) | ECK/Filebeat/Kafka/Logstash |

建议按「基础环境 → 二进制安装 → 组件配置 → 高可用 → 迁移 → 插件」的顺序阅读，容器化安装可独立参考。
