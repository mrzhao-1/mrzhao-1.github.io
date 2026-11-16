+++
title = "Kubernetes 迁移环境配置"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "迁移", "uuid", "hosts", "节点"]
summary = "虚拟机克隆/迁移后的环境处理：网卡 UUID 与 MachineID 重生成、hosts 配置、以及 etcd/apiserver/kubelet/kube-proxy 节点组件配置。"
tags = ["k8s", "kubernetes", "migration"]
+++

# Kubernetes 迁移环境配置

本文介绍虚拟机克隆或模板迁移到新节点后的环境处理，以及节点组件（etcd、apiserver、kubelet、kube-proxy）的配置。所有 IP、主机名均为占位符。

<!--more-->

---

## 一、检查网络与根目录空间

迁移前确认网络连通、根目录有足够空间。

---

## 二、网卡 UUID 与 MachineID 重新生成

若虚拟机是从模板克隆，网卡 UUID 与 MachineID 会重复，导致无法 DHCP 获取 IPv6 地址：

```bash
# 重新生成 MachineID
rm -f /etc/machine-id /var/lib/dbus/machine-id
systemd-machine-id-setup

# 重新生成网卡 UUID（或删除后重启由系统重建）
# 视发行版处理，确保每个节点唯一
```

> 同时按环境清理模板残留（如 cloud-init、pve 清理脚本等）。

---

## 三、/etc/hosts 配置

```bash
cat >> /etc/hosts <<EOF
<master01-IP> master01
<master02-IP> master02
<master03-IP> master03
<node01-IP>   node01
<VIP>         k8s-api
EOF
```

---

## 四、节点组件配置

### 4.1 etcd

```bash
cat > /etc/systemd/system/etcd.service <<EOF
[Unit]
Description=Etcd Server

[Service]
ExecStart=/usr/local/bin/etcd \
  --name=<本节点名> \
  --data-dir=/var/lib/etcd \
  --listen-peer-urls=https://<节点IP>:2380 \
  --listen-client-urls=https://<节点IP>:2379,https://127.0.0.1:2379 \
  --advertise-client-urls=https://<节点IP>:2379 \
  --initial-advertise-peer-urls=https://<节点IP>:2380 \
  --initial-cluster=master01=https://<master01-IP>:2380,master02=https://<master02-IP>:2380,master03=https://<master03-IP>:2380 \
  --cert-file=/etc/etcd/ssl/etcd.pem \
  --key-file=/etc/etcd/ssl/etcd-key.pem \
  --trusted-ca-file=/etc/etcd/ssl/etcd-ca.pem \
  --peer-cert-file=/etc/etcd/ssl/etcd.pem \
  --peer-key-file=/etc/etcd/ssl/etcd-key.pem \
  --peer-trusted-ca-file=/etc/etcd/ssl/etcd-ca.pem

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now etcd
systemctl status etcd
```

验证 etcd 健康：

```bash
export ETCDCTL_API=3
etcdctl --endpoints="https://<master01-IP>:2379" \
  --cacert=/etc/etcd/ssl/etcd-ca.pem \
  --cert=/etc/etcd/ssl/etcd.pem \
  --key=/etc/etcd/ssl/etcd-key.pem \
  endpoint status --write-out=table
```

### 4.2 kube-apiserver

```bash
cat > /etc/systemd/system/kube-apiserver.service <<EOF
[Unit]
Description=Kubernetes API Server

[Service]
ExecStart=/usr/local/bin/kube-apiserver \
  --advertise-address=<节点IP> \
  --etcd-servers=https://<master01-IP>:2379,https://<master02-IP>:2379,https://<master03-IP>:2379 \
  --etcd-cafile=/etc/etcd/ssl/etcd-ca.pem \
  --etcd-certfile=/etc/etcd/ssl/etcd.pem \
  --etcd-keyfile=/etc/etcd/ssl/etcd-key.pem \
  --service-cluster-ip-range=<service网段> \
  --service-account-key-file=/etc/kubernetes/pki/sa.pub \
  --tls-cert-file=/etc/kubernetes/pki/apiserver.pem \
  --tls-private-key-file=/etc/kubernetes/pki/apiserver-key.pem \
  --client-ca-file=/etc/kubernetes/pki/ca.pem \
  --kubelet-client-certificate=/etc/kubernetes/pki/apiserver.pem \
  --kubelet-client-key=/etc/kubernetes/pki/apiserver-key.pem \
  --requestheader-client-ca-file=/etc/kubernetes/pki/front-proxy-ca.pem \
  --requestheader-allowed-names=front-proxy-client \
  --enable-bootstrap-token-auth=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now kube-apiserver
systemctl status kube-apiserver
```

### 4.3 kubelet 与 kube-proxy

见 [系统组件配置]({{< ref "install-components" >}}) 的 kubelet / kube-proxy 章节。

> 关键：kubelet 的 `--node-ip` 需替换为每个节点自己的 IP；bootstrap token 各节点共用。

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航，或继续阅读 [集群插件]({{< ref "install-plugins" >}})。
