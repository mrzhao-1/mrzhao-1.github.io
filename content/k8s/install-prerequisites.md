+++
title = "Kubernetes 基础环境配置"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "基础环境", "内核参数", "ipvs"]
summary = "Kubernetes 二进制安装前的系统基础环境配置：yum 源、防火墙、交换分区、网络、时间同步、ulimit、ipvsadm 与内核参数。"
tags = ["k8s", "kubernetes", "prerequisites"]
+++

# Kubernetes 基础环境配置

本文介绍 Kubernetes 二进制安装前的系统初始化，是所有节点（master + node）都需要执行的基础配置。所有示例 IP、域名、主机名均为占位符。

<!--more-->

---

## 一、配置 yum / apt 源

```bash
# CentOS/RHEL
yum install -y epel-release
# Ubuntu/Debian
apt update
```

---

## 二、关闭防火墙

```bash
# CentOS
systemctl disable --now firewalld
# Ubuntu
systemctl disable --now ufw
```

---

## 三、关闭交换分区（swap）

Kubernetes 要求关闭 swap，否则 kubelet 会报错：

```bash
swapoff -a
sed -i '/swap/s/^/#/' /etc/fstab
```

---

## 四、网络服务配置

确保各节点网络互通、主机名可解析（详见 [迁移环境配置]({{< ref "migration" >}}) 的 hosts 配置）。

---

## 五、时间同步

```bash
# CentOS
yum install -y chrony && systemctl enable --now chronyd
# Ubuntu
apt install -y chrony && systemctl enable --now chrony
```

---

## 六、配置 ulimit

```bash
cat >> /etc/security/limits.conf <<EOF
* soft nofile 65535
* hard nofile 65535
EOF
```

---

## 七、安装 ipvsadm 等工具

```bash
# CentOS
yum install -y ipvsadm ipset sysstat conntrack
# Ubuntu
apt install -y ipvsadm ipset sysstat conntrack
```

---

## 八、修改内核参数

Kubernetes 要求开启网桥过滤等内核参数：

```bash
cat > /etc/sysctl.d/k8s.conf <<EOF
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF
sysctl --system
```

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航，或继续阅读 [软件包与证书]({{< ref "install-binary" >}})。
