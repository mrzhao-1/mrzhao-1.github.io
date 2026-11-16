+++
title = "Kubernetes 基础环境配置"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "基础环境", "内核参数", "ipvs", "selinux"]
summary = "Kubernetes 二进制安装前的系统基础环境配置：yum 源、SELinux、交换分区、网络、时间同步、ulimit、ipvs 模块与完整内核参数。"
tags = ["k8s", "kubernetes", "prerequisites"]
+++

# Kubernetes 基础环境配置

本文介绍 Kubernetes 二进制安装前的系统初始化，是所有节点（master + node）都需要执行的基础配置。参考 cby-chen/Kubernetes 的二进制离线安装方案。所有 IP、域名、主机名均为占位符。

<!--more-->

---

## 一、配置 yum / apt 源

```bash
# openEuler
# https://mirrors.ustc.edu.cn/openeuler
# 若出现 Errors during downloading metadata，将 metalink 注释后重新执行

# Ubuntu / Debian
sudo apt update && sudo apt upgrade -y && sudo apt install -y \
  wget psmisc vim net-tools nfs-kernel-server telnet lvm2 git tar curl gcc \
  keepalived haproxy bash-completion chrony sshpass \
  ipvsadm ipset sysstat conntrack libseccomp
```

---

## 二、关闭防火墙与 SELinux

```bash
# 关闭防火墙（Ubuntu 默认无 firewalld）
systemctl disable --now firewalld

# 关闭 SELinux（Ubuntu 默认无）
setenforce 0
sed -i 's#SELINUX=enforcing#SELINUX=disabled#g' /etc/selinux/config
```

---

## 三、关闭交换分区（swap）

```bash
sed -ri 's/.swap./#&/' /etc/fstab
swapoff -a && sysctl -w vm.swappiness=0
```

---

## 四、网络服务配置（Calico）

配置 NetworkManager 忽略 calico 接口，避免其管理 cali*/tunl* 网卡：

```bash
cat > /etc/NetworkManager/conf.d/calico.conf <<EOF
[keyfile]
unmanaged-devices=interface-name:cali*;interface-name:tunl*
EOF
systemctl restart NetworkManager
```

---

## 五、时间同步（chrony）

```bash
# 修改 /etc/chrony/chrony.conf（Ubuntu）或 /etc/chrony.conf（openEuler）：
# pool ntp.aliyun.com iburst maxsources 4
# allow <节点网段>
# local stratum 10

sudo systemctl restart chrony
sudo systemctl enable chrony
```

---

## 六、配置 ulimit

```bash
ulimit -SHn 65535
cat >> /etc/security/limits.conf <<EOF
* soft nofile 655360
* hard nofile 131072
* soft nproc 655350
* hard nproc 655350
* soft memlock unlimited
* hard memlock unlimited
EOF
```

---

## 七、安装 ipvsadm 与加载 ipvs 模块

```bash
# Ubuntu: apt install ipvsadm ipset sysstat conntrack -y
yum install ipvsadm ipset sysstat conntrack libseccomp -y

# 加载 ipvs 相关模块（所有发行版都执行）
cat >> /etc/modules-load.d/ipvs.conf <<EOF
ip_vs
ip_vs_rr
ip_vs_wrr
ip_vs_sh
nf_conntrack
ip_tables
ip_set
xt_set
ipt_set
ipt_rpfilter
ipt_REJECT
ipip
EOF

systemctl restart systemd-modules-load.service
lsmod | grep -e ip_vs -e nf_conntrack
```

---

## 八、修改内核参数

```bash
cat <<EOF > /etc/sysctl.d/k8s.conf
net.ipv4.ip_forward = 1
net.bridge.bridge-nf-call-iptables = 1
fs.may_detach_mounts = 1
vm.overcommit_memory=1
vm.panic_on_oom=0
fs.inotify.max_user_watches=89100
fs.file-max=52706963
fs.nr_open=52706963
net.netfilter.nf_conntrack_max=2310720

net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_probes = 3
net.ipv4.tcp_keepalive_intvl =15
net.ipv4.tcp_max_tw_buckets = 36000
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_max_orphans = 327680
net.ipv4.tcp_orphan_retries = 3
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 16384
net.ipv4.tcp_timestamps = 0
net.core.somaxconn = 16384

net.ipv6.conf.all.disable_ipv6 = 0
net.ipv6.conf.default.disable_ipv6 = 0
net.ipv6.conf.lo.disable_ipv6 = 0
net.ipv6.conf.all.forwarding = 1
EOF

sysctl --system
```

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航，或继续阅读 [软件包与证书]({{< ref "install-binary" >}})。
