+++
title = "Kubernetes 集群插件"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "插件", "镜像", "coredns", "cnI"]
summary = "Kubernetes 集群插件（CNI、CoreDNS、Dashboard 等）的镜像处理与部署。"
tags = ["k8s", "kubernetes", "plugins"]
+++

# Kubernetes 集群插件

本文介绍集群插件（CNI 网络、CoreDNS、Dashboard 等）的镜像处理与部署。内网环境下，插件镜像通常需要先同步到内网镜像仓库。

<!--more-->

---

## 一、处理插件镜像

### 1.1 手动处理

内网无法直接拉取外网镜像时，先将插件镜像同步到内网仓库：

```bash
# 需要同步的典型插件镜像（示例）：
#   calico / flannel / cilium（CNI）
#   coredns/coredns
#   registry.k8s.io/pause
#   kubernetes-dashboard

for img in <插件镜像列表>; do
  ctr -n k8s.io images pull --all-platforms ${img}
  ctr -n k8s.io images tag ${img} <registry>/mirror/${img}
  ctr -n k8s.io images push --plain-http --user <user>:<password> <registry>/mirror/${img}
done
```

### 1.2 部署镜像

将同步好的镜像 tag 回原镜像名，或直接在插件清单中指定内网镜像地址，然后 `kubectl apply`。

---

## 二、部署 CNI 网络插件

以 Calico 为例：

```bash
kubectl apply -f calico.yaml
# 或
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml
```

验证：

```bash
kubectl get pods -n kube-system
kubectl get nodes   # 所有节点 Ready
```

---

## 三、部署 CoreDNS

二进制安装需手动部署 CoreDNS（kubeadm 会自动部署）：

```bash
kubectl apply -f coredns.yaml
kubectl get pods -n kube-system | grep coredns
```

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航，或继续阅读 [容器化安装（kubeadm）]({{< ref "install-containerized" >}})。
