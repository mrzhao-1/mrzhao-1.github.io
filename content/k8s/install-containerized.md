+++
title = "Kubernetes 容器化安装（kubeadm）"
date = 2025-10-02T11:10:00+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "kubeadm", "容器化安装", "cni"]
summary = "补充的 Kubernetes 容器化安装方案：使用 kubeadm 一键初始化控制面（组件以静态 Pod 运行），并加入工作节点。"
tags = ["k8s", "kubernetes", "kubeadm", "install"]
+++

# Kubernetes 容器化安装（kubeadm）

本文是二进制安装之外的**容器化安装方案**。kubeadm 是 Kubernetes 官方的集群引导工具：它把 kube-apiserver、kube-controller-manager、kube-scheduler 以**静态 Pod（容器）**方式运行，由 kubelet 托管，无需手工写 systemd 单元与生成证书，大幅简化安装。

<!--more-->

---

## 一、与二进制安装的对比

| 维度 | 二进制安装 | kubeadm 容器化安装 |
| --- | --- | --- |
| 控制面运行方式 | systemd 直接运行二进制 | 静态 Pod（容器）由 kubelet 托管 |
| 证书生成 | cfssl 手工生成 | kubeadm 自动生成与续期 |
| 复杂度 | 高，可控性最强 | 低，官方推荐 |
| 适合场景 | 深度定制、学习原理 | 生产与测试的常规选择 |

---

## 二、前提条件

与 [基础环境配置]({{< ref "install-prerequisites" >}}) 完全一致（关闭 swap、配置内核参数、安装容器运行时 containerd 等）。

---

## 三、安装 kubeadm / kubelet / kubectl

```bash
# 配置 yum 源（CentOS）
cat > /etc/yum.repos.d/kubernetes.repo <<EOF
[kubernetes]
name=Kubernetes
baseurl=https://mirrors.example.com/kubernetes/yum/repos/kubernetes-el7-x86_64
enabled=1
gpgcheck=0
EOF

yum install -y kubeadm kubelet kubectl
systemctl enable --now kubelet
```

> 内网环境可下载 rpm 包离线安装，或将组件二进制放入 `/usr/local/bin` 后由 kubeadm 使用。

---

## 四、初始化控制面

```bash
# 单控制面
kubeadm init \
  --kubernetes-version=v1.32.0 \
  --image-repository=<registry>/google_containers \
  --pod-network-cidr=<pod网段> \
  --service-cidr=<service网段>
```

**高可用场景**（多 master + VIP）：

```bash
kubeadm init \
  --control-plane-endpoint="<VIP>:6443" \
  --upload-certs \
  --kubernetes-version=v1.32.0 \
  --image-repository=<registry>/google_containers \
  --pod-network-cidr=<pod网段> \
  --service-cidr=<service网段>
```

初始化成功后，输出中会给出 `kubeadm join` 命令（含 token 与 discovery hash）。

---

## 五、配置 kubectl

```bash
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config

kubectl get nodes
```

---

## 六、安装 CNI 网络插件

```bash
kubectl apply -f calico.yaml
# 或 flannel / cilium
```

等待节点 Ready：

```bash
kubectl get nodes -w
```

---

## 七、加入节点

工作节点执行（来自 init 输出，或重新生成）：

```bash
kubeadm join <VIP>:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
```

新增控制面节点（HA）：

```bash
kubeadm join <VIP>:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash> \
  --control-plane --certificate-key <key>
```

---

## 八、验证集群

```bash
kubectl get nodes
kubectl get pods -A
kubectl cluster-info
```

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航。
