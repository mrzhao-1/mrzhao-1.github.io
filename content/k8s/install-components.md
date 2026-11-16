+++
title = "Kubernetes 系统组件配置"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "containerd", "controller-manager", "scheduler", "kubelet"]
summary = "配置 Containerd 运行时，以及 kube-controller-manager、kube-scheduler、kubelet、kube-proxy 的 systemd 单元与 bootstrap-token。"
tags = ["k8s", "kubernetes", "components"]
+++

# Kubernetes 系统组件配置

本文介绍二进制安装中的系统组件配置：Containerd 运行时，以及各控制面/节点组件的 systemd 单元配置。所有 IP、网段、路径均为占位符。

<!--more-->

---

## 一、安装 Containerd 运行时

```bash
# 安装 containerd
wget https://mirrors.example.com/containerd-xxx.tar.gz -O /tmp/containerd.tar.gz
tar -xzf /tmp/containerd.tar.gz -C /

# 生成默认配置
mkdir -p /etc/containerd
containerd config default > /etc/containerd/config.toml

# 关键修改：
# 1. sandbox 镜像（pause）指向内网镜像仓库
# 2. 配置镜像加速器 / registry mirror
```

修改 `/etc/containerd/config.toml`，将 `sandbox_image` 改为内网 pause 镜像，并配置 registry mirror 指向内网仓库：

```toml
[plugins."io.containerd.grpc.v1.cri"]
  sandbox_image = "<registry>/pause:3.9"
  [plugins."io.containerd.grpc.v1.cri".registry.mirrors]
    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.io"]
      endpoint = ["<内网镜像加速地址>"]
```

启动：

```bash
systemctl daemon-reload
systemctl enable --now containerd
systemctl status containerd
```

---

## 二、部署 k8s 通用配置（所有 master 节点相同）

```bash
# 创建配置目录
mkdir -p /etc/kubernetes

# kube-controller-manager.kubeconfig / kube-scheduler.kubeconfig 等
# 已在「证书」阶段生成，放置到 /etc/kubernetes/
```

---

## 三、kube-controller-manager

```bash
cat > /etc/systemd/system/kube-controller-manager.service <<EOF
[Unit]
Description=Kubernetes Controller Manager

[Service]
ExecStart=/usr/local/bin/kube-controller-manager \
  --kubeconfig=/etc/kubernetes/controller-manager.kubeconfig \
  --cluster-cidr=<pod网段> \
  --service-cluster-ip-range=<service网段> \
  --cluster-signing-cert-file=/etc/kubernetes/pki/ca.pem \
  --cluster-signing-key-file=/etc/kubernetes/pki/ca-key.pem

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now kube-controller-manager
systemctl status kube-controller-manager
```

---

## 四、kube-scheduler

```bash
cat > /etc/systemd/system/kube-scheduler.service <<EOF
[Unit]
Description=Kubernetes Scheduler

[Service]
ExecStart=/usr/local/bin/kube-scheduler --kubeconfig=/etc/kubernetes/scheduler.kubeconfig

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now kube-scheduler
systemctl status kube-scheduler
```

---

## 五、bootstrap-token

将 bootstrap token 写入 `bootstrap.secret.yaml`，供 kubelet 首次加入集群时申请证书：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: bootstrap-token-<token-id>
  namespace: kube-system
type: bootstrap.kubernetes.io/token
stringData:
  token-id: <token-id>
  token-secret: <token-secret>
  usage-bootstrap-signing: "true"
```

> token 位置在 `bootstrap.secret.yaml`，如需修改在此文件修改，各节点执行时读取同一 token。

---

## 六、kubelet

```bash
cat > /etc/systemd/system/kubelet.service <<EOF
[Unit]
Description=Kubernetes Kubelet
After=containerd.service
Requires=containerd.service

[Service]
ExecStart=/usr/local/bin/kubelet \
  --bootstrap-kubeconfig=/etc/kubernetes/bootstrap.kubeconfig \
  --kubeconfig=/etc/kubernetes/kubelet.kubeconfig \
  --container-runtime-endpoint=unix:///run/containerd/containerd.sock \
  --node-ip=<节点IP>

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now kubelet
systemctl status kubelet
```

---

## 七、kube-proxy

```bash
cat > /etc/systemd/system/kube-proxy.service <<EOF
[Unit]
Description=Kubernetes Kube Proxy

[Service]
ExecStart=/usr/local/bin/kube-proxy --kubeconfig=/etc/kubernetes/kube-proxy.kubeconfig

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now kube-proxy
systemctl status kube-proxy
```

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航，或继续阅读 [高可用配置]({{< ref "install-ha" >}})。
