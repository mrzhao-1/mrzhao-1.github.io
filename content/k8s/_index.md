+++
title = "Kubernetes 运维指南"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "安装", "二进制安装", "证书", "高可用", "kubeadm"]
summary = "Kubernetes 运维系列文档的总目录，涵盖基础环境、二进制安装、组件配置、高可用、迁移与容器化安装。"
tags = ["k8s", "kubernetes", "guide"]
+++

# Kubernetes 运维指南

这里是 Kubernetes 运维系列文档的总目录。整体介绍与各模块入口见 [总览与主文档]({{< ref "/post/k8s-guide" >}})。

各分文档：

- [总览与主文档]({{< ref "/post/k8s-guide" >}}) —— 整体介绍与各模块引导。
- [基础环境配置]({{< ref "install-prerequisites" >}}) —— yum 源、防火墙、交换分区、内核参数等。
- [二进制安装 · 软件包与证书]({{< ref "install-binary" >}}) —— 下载二进制、cfssl 生成各组件证书。
- [系统组件配置]({{< ref "install-components" >}}) —— Containerd、controller-manager、scheduler 等。
- [高可用配置]({{< ref "install-ha" >}}) —— haproxy + keepalived VIP。
- [迁移环境配置]({{< ref "migration" >}}) —— 网卡 UUID、hosts、节点组件、etcd/kubelet 等。
- [集群插件]({{< ref "install-plugins" >}}) —— 插件镜像处理与部署。
- [容器化安装（kubeadm）]({{< ref "install-containerized" >}}) —— 补充的容器化安装方案。

> 说明：github-style 主题的 `list.html` 只渲染子页面列表，不渲染本页正文。完整的「主文档」内容请阅读 [总览与主文档]({{< ref "/post/k8s-guide" >}})。
