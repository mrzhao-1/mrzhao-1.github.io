+++
title = "Kubernetes 二进制安装 · 软件包与证书"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "二进制安装", "cfssl", "证书", "etcd"]
summary = "下载 Kubernetes 与 etcd 二进制，使用 cfssl 生成 etccd、apiserver、controller-manager、scheduler、admin、kube-proxy 等组件证书。"
tags = ["k8s", "kubernetes", "install", "certificate"]
+++

# Kubernetes 二进制安装 · 软件包与证书

本文介绍 Kubernetes 二进制安装方式中的软件包下载与证书生成。二进制安装方式需手动下载各组件二进制，并用 cfssl 生成整套 TLS 证书。

> 版本示例：k8s v1.32.0、etcd v3.5.17、cfssl v1.6.4。所有 IP、域名、主机名均为占位符。
>
> 参考来源：[cby-chen/Kubernetes 二进制离线安装](https://github.com/cby-chen/Kubernetes)

<!--more-->

---

## 零、目录规划与 PATH

按参考方案，将可独立使用的软件包和配置文件统一安装到 `/opt` 目录，后续迁移时把 `/opt` 挂载专用目录，服务单元文件与系统文件用软连接挂接到 systemd 指定目录：

```bash
# 解压后的二进制放到 /opt/kubernetes/bin、/opt/etcd/bin 等
# /etc/profile 中追加 PATH：
containerd_bin=/opt/containerd/bin
crictl_bin=/opt/crictl/bin
etcd_bin=/opt/etcd/bin
kubernetes_bin=/opt/kubernetes/bin
PATH=${containerd_bin}:${crictl_bin}:${etcd_bin}:${kubernetes_bin}:$PATH

source /etc/profile
```

在 `/etc/sudoers` 的 `secure_path` 中追加：
`/opt/containerd/bin:/opt/crictl/bin:/opt/etcd/bin:/opt/kubernetes/bin:/opt/docker/bin`

> 环境配好后，建议用 `btrfs subvolume snapshot / /@snapshots/@rootfs-xxx` 打快照，便于回滚。

---

## 一、下载 k8s 与 etcd 二进制

```bash
# 下载（示例，实际用国内镜像或自建仓库）
wget https://mirrors.example.com/etcd/releases/download/v3.5.17/etcd-v3.5.17-linux-amd64.tar.gz
wget https://cdn.dl.k8s.io/release/v1.32.0/kubernetes-server-linux-amd64.tar.gz

# 解压 k8s 组件（--strip-components=3 忽略前三级目录，直接提取二进制）
mkdir -p /opt/kubernetes/bin
tar -xf kubernetes-server-linux-amd64.tar.gz --strip-components=3 \
  -C /opt/kubernetes/bin kubernetes/server/bin/kube{let,ctl,-apiserver,-controller-manager,-scheduler,-proxy}

# 解压 etcd
mkdir -p /opt/etcd/bin
tar -xf etcd*.tar.gz && mv etcd-*/etcd /opt/etcd/bin && mv etcd-*/etcdctl /opt/etcd/bin

# 验证版本
kubelet --version
etcdctl version

# 所有节点执行：准备 CNI 二进制目录
mkdir -p /opt/cni/bin
```

> 后续各组件 systemd 单元中的 `ExecStart` 需指向 `/opt/kubernetes/bin/...`、`/opt/etcd/bin/...` 下的实际路径。

---

## 二、部署证书工具 cfssl

```bash
wget https://mirrors.example.com/cfssl/releases/download/v1.6.4/cfssl_1.6.4_linux_amd64 -O /usr/local/bin/cfssl
wget https://mirrors.example.com/cfssl/releases/download/v1.6.4/cfssljson_1.6.4_linux_amd64 -O /usr/local/bin/cfssljson
chmod +x /usr/local/bin/cfssl /usr/local/bin/cfssljson
```

---

## 三、生成证书

### 3.1 证书清单

| 证书 | 用途 |
| --- | --- |
| etcd-ca / etcd / etcd-key | etcd 集群 TLS |
| ca / apiserver / apiserver-key | kube-apiserver 服务端证书 |
| front-proxy-ca / front-proxy-client | apiserver 聚合层（metrics-server 等） |
| controller-manager / scheduler / admin / kube-proxy | 各组件的客户端证书 |
| ServiceAccount key | ServiceAccount 签名密钥 |
| bootstrap-token | kubelet TLS Bootstrapping |

### 3.2 生成 CA 配置

```bash
cat > ca-config.json <<EOF
{
  "signing": {
    "default": { "expiry": "876000h" },
    "profiles": {
      "kubernetes": {
        "usages": ["signing", "key encipherment", "server auth", "client auth"],
        "expiry": "876000h"
      }
    }
  }
}
EOF
```

### 3.3 生成 etcd 证书

```bash
cat > etcd-csr.json <<EOF
{
  "CN": "etcd",
  "hosts": ["<etcd节点IP>...", "127.0.0.1"],
  "key": { "algo": "rsa", "size": 2048 }
}
EOF

cfssl gencert -ca=etcd-ca.pem -ca-key=etcd-ca-key.pem \
  -config=ca-config.json -profile=kubernetes etcd-csr.json | cfssljson -bare etcd
```

### 3.4 生成 kube-apiserver 证书

```bash
cat > apiserver-csr.json <<EOF
{
  "CN": "kube-apiserver",
  "hosts": [
    "127.0.0.1",
    "<master节点IP>...",
    "<service网段第一个地址>",   # 如 10.96.0.1
    "<VIP>",                    # 高可用 VIP
    "kubernetes", "kubernetes.default", "kubernetes.default.svc",
    "kubernetes.default.svc.cluster.local",
    "*.example.com", "example.com"
  ],
  "key": { "algo": "rsa", "size": 2048 }
}
EOF

cfssl gencert -ca=ca.pem -ca-key=ca-key.pem \
  -config=ca-config.json -profile=kubernetes apiserver-csr.json | cfssljson -bare apiserver
```

### 3.5 生成聚合层证书（front-proxy）

```bash
cfssl gencert -ca=front-proxy-ca.pem -ca-key=front-proxy-ca-key.pem \
  -config=ca-config.json -profile=kubernetes front-proxy-client-csr.json \
  | cfssljson -bare front-proxy-client
```

### 3.6 生成各组件客户端证书

controller-manager、scheduler、admin、kube-proxy 的证书类似，都是客户端证书（`CN` 为对应组件身份，如 `system:kube-controller-manager`、`system:kube-scheduler`、`kubernetes-admin`、`system:kube-proxy`）。

### 3.7 生成 ServiceAccount 密钥

```bash
openssl genrsa -out sa.key 2048
openssl rsa -in sa.key -pubout -out sa.pub
```

### 3.8 TLS Bootstrapping 配置

为 kubelet 配置 bootstrap token，允许节点用 token 向 apiserver 申请客户端证书：

```bash
kubectl config set-cluster kubernetes --certificate-authority=ca.pem --server=https://<VIP>:6443 \
  --embed-certs --kubeconfig=bootstrap.kubeconfig
kubectl config set-credentials kubelet-bootstrap --token=<bootstrap-token> \
  --kubeconfig=bootstrap.kubeconfig
```

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航，或继续阅读 [系统组件配置]({{< ref "install-components" >}})。
