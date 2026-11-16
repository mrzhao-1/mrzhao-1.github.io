+++
title = "GitLab 安装 · Kubernetes 部署"
date = 2025-03-24T10:20:00+08:00
draft = false
author = ""
keywords = ["gitlab", "kubernetes", "helm", "ceph", "rook", "安装", "对象存储"]
summary = "使用 Helm Chart 在 Kubernetes 中部署 GitLab CE，含 Ceph/Rook 对象存储、外部 PostgreSQL/Redis、TLS、Runner 与 KAS 的配置。"
tags = ["gitlab", "kubernetes", "helm", "install"]
+++

# GitLab 安装 · Kubernetes 部署

在 Kubernetes 中使用官方 Helm Chart 部署 GitLab。相比 Omnibus/Docker，K8s 部署最复杂，需要提前规划存储、数据库与网络。本系列文档用 **gitlab-k8s** 简称此部署方式。

> 所有域名、IP、Secret、集群名称均为占位符。官方 chart 方案要求 **Gitaly 与数据库使用裸机/独立集群**提供资源，常规做法是 Gitaly 用 Raft 集群、数据库用独立 PostgreSQL 集群。

<!--more-->

---

## 一、组件概述

| 组件 | 作用 |
| --- | --- |
| **Webservice** | 前台同步请求处理者 |
| **Sidekiq** | 后台异步任务处理者 |
| **Gitaly** | Git 仓库 RPC 存储服务 |
| **Toolbox** | 提供 `gitlab-rake`、`backup-utility` 等管理命令 |
| **Registry** | 容器镜像仓库 |
| **KAS** | GitLab Agent Server |

---

## 二、安装准备

### 2.1 前提条件

- 可用的 Kubernetes 集群与 `helm`、`kubectl`。
- 配置好对象存储（Ceph RGW / Rook OBC，或 MinIO/S3 兼容存储）。
- 独立的 PostgreSQL 集群与 Redis/Valkey（可选，用于替代内置组件）。
- TLS 证书（Ingress 使用）。

### 2.2 后端存储架构设计

GitLab 各组件对存储的要求不同，需分别规划：

| 数据 | 存储后端 | 说明 |
| --- | --- | --- |
| Git 仓库（Gitaly） | Ceph RBD（块存储） | 核心状态数据，需要高性能与可靠 |
| PostgreSQL | Ceph RBD / 独立集群 | 数据库数据 |
| Redis | 独立集群 / Ceph RBD | 缓存与队列 |
| LFS / Uploads / Artifacts / Packages | 对象存储（S3） | 官方强依赖对象存储 |
| 备份（Toolbox） | 对象存储或 NFS | backup-utility 默认与 S3 交互 |

### 2.3 准备 TLS 证书

为 Ingress 域名生成自签或正式证书。生成自签证书时，SAN 需包含域名与通配符：

```bash
openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout tls.key -out tls.crt -days 3650 \
  -subj "/CN=gitlab.example.com" \
  -addext "subjectAltName=DNS:*.example.com,DNS:example.com"
```

确认证书 SAN 匹配：

```bash
openssl x509 -in tls.crt -noout -text | grep -A1 "Subject Alternative Name"
# 应输出 DNS:*.example.com, DNS:example.com
```

### 2.4 创建对象存储桶（Ceph RGW / Rook OBC）

通过 Rook 的 ObjectBucketClaim 申请桶（以 Registry 为例）：

```yaml
# gitlab-registry-obc.yaml
apiVersion: objectbucket.io/v1alpha1
kind: ObjectBucketClaim
metadata:
  name: gitlab-registry-obc
  namespace: gitlab
spec:
  bucketName: gitlab-registry
  storageClassName: ceph-bucket
```

```bash
kubectl apply -f gitlab-registry-obc.yaml
# 查看 OBC 状态，确认为 Bound
kubectl get obc -n gitlab
# 从同名 Secret 中提取 Access Key / Secret Key 与 Endpoint
kubectl get secret gitlab-registry-obc -n gitlab -o yaml
```

---

## 三、自定义 gitlab 配置

### 3.1 使用社区版（CE）

Helm Chart 默认镜像为 EE，需显式切换到 CE：

```yaml
global:
  edition: ce
```

### 3.2 Gitaly / PostgreSQL / Redis 后端存储为 Ceph

- 关闭内置 MinIO 组件。
- Gitaly、PostgreSQL、Redis 等核心状态数据使用 Ceph RBD 的 StorageClass。
- LFS / Uploads / Artifacts / Packages 使用对象存储（S3）。

### 3.3 LFS / Uploads / Artifacts / Packages 配置对象存储

在 `values.yaml` 中为各类数据配置对象存储连接（使用同一套 S3 Secret 或分别配置）：

```yaml
global:
  appConfig:
    object_store:
      enabled: true
      connection:
        secret: gitlab-object-store-connection
        key: connection
    artifacts:
      enabled: true
      bucket: gitlab-artifacts
    lfs:
      enabled: true
      bucket: gitlab-lfs
    uploads:
      enabled: true
      bucket: gitlab-uploads
    packages:
      enabled: true
      bucket: gitlab-packages
```

连接 Secret 内容示例（`object-store-connection.yaml`）：

```yaml
provider: AWS
region: us-east-1
host: <BUCKET_HOST>
endpoint: http://<BUCKET_HOST>
path_style: true
aws_access_key_id: <ACCESS_KEY>
aws_secret_access_key: <SECRET_KEY>
```

```bash
kubectl create secret generic gitlab-object-store-connection \
  --from-file=connection=object-store-connection.yaml -n gitlab
```

> 说明：Artifacts、LFS、Uploads、Packages 对对象存储有强依赖，仅用 NFS 会触发「增量日志需对象存储」等限制。

### 3.4 Toolbox 备份后端

Toolbox 的 `backup-utility` 默认与 S3 交互，需为其提供备份后端。可配置 S3 连接 Secret；若只有 NFS，可挂载 NFS 路径并改造 `backup-utility` 脚本（将 `s3cmd put` 替换为 `cp`）。

### 3.5 禁用内置 Prometheus

如需合并到外部监控，禁用内置 Prometheus：

```yaml
prometheus:
  install: false
```

### 3.6 连接外部 Redis（Valkey）

禁用内置 Redis，连接外部 Valkey/Sentinel 集群：

```bash
kubectl create secret generic gitlab-valkey-sentinel-auth \
  --from-literal=password='<sentinel-password>' -n gitlab
```

在 `values.yaml` 中配置外部 Redis 地址与认证 Secret。

### 3.7 连接外部 PostgreSQL

禁用内置 PostgreSQL，连接独立 PostgreSQL 集群（通过 PgBouncer 代理访问）：

- 准备 `gitlab` 数据库用户与主库/CI 库。
- 主库、CI 库密码分别存入 Secret：

```bash
kubectl create secret generic gitlab-pg-password \
  --from-literal=password='<main-password>' \
  --from-literal=ci-password='<ci-password>' -n gitlab
```

- migrations Job 直连主节点（DDL 在 PgBouncer transaction 池下不可靠），应用连接走 PgBouncer。

---

## 四、开始安装部署

### 4.1 执行 Helm 安装

```bash
helm upgrade --install my-gitlab gitlab/gitlab \
  --namespace gitlab \
  --create-namespace \
  --values ./my-gitlab.yaml \
  --timeout 600s
```

### 4.2 查看 Pod 状态

```bash
kubectl get pods -n gitlab
```

关键检查项：

- 核心 Pod 均为 `Running`。
- `migrations` Job 状态为 `Completed`。
- 证书 Secret 的 SAN 匹配 Ingress 域名。
- 核心 PVC 使用 `ceph-block`，共享/备份 PVC 使用预期 StorageClass。
- Registry 的 S3 Secret 已挂载，Pod 正常。

### 4.3 验证与登录

```bash
# 用 curl 测试（指定 Host 头）
curl -H "Host: gitlab.example.com" https://<ingress-ip>/ -k
```

首次登录后，创建一个测试项目确认数据库读写正常。

### 4.4 卸载（谨慎）

```bash
helm uninstall my-gitlab -n gitlab
# 若 Job 卡住，移除 Finalizer；若需彻底清理，再删除 PVC
```

---

## 五、配置 GitLab Runner

### 5.1 使用内置 Runner 的注意点

chart 自带 Runner，需关注证书信任与缓存：

- 若使用自签 CA，需将 CA 证书注入 Runner（挂载到运行环境并更新系统证书库）。
- 检查 Runner Pod 的 hosts 与证书配置。

### 5.2 配置持久化缓存（S3）

为 Runner 配置 S3 缓存（使用 Rook OBC）：

```yaml
gitlab-runner:
  runners:
    cache:
      s3:
        bucketName: gitlab-runner-cache
        serverAddress: <S3_ENDPOINT>
        accessKey: <ACCESS_KEY>
        secretKey: <SECRET_KEY>
```

从 OBC 生成的 Secret 中提取 Access Key / Secret Key 与 Endpoint，升级 release 并重建 Runner Pod 加载新配置。

---

## 六、配置 KAS（GitLab Agent Server）

1. 确认 KAS 服务端在 `values.yaml` 中已启用。
2. 在目标集群安装并注册 Agent（手动安装或通过 UI 一键安装）。
3. 验证 Agent 与 KAS 连接正常。

---

## 七、常见问题

| 问题 | 处理 |
| --- | --- |
| 证书错误 / ingress 日志报证书不匹配 | 检查 Secret 中证书 SAN 是否包含域名 |
| migrations Job 失败 | 查看 Job 日志，确认 PgBouncer 直连配置正确 |
| Pod `Init:CrashLoopBackOff` | 多为依赖服务（DB/Redis）未就绪或 Secret 缺失 |
| Artifacts 启用报错 | 需先配置对象存储，无法仅用 NFS |
| 内置 MinIO 未关闭 | 确认关闭 minio 并用外部存储替代 |

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [组件与集成配置]({{< ref "configuration" >}})。
