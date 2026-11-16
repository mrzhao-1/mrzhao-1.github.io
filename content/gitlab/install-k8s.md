+++
title = "GitLab 安装 · Kubernetes 部署"
date = 2025-03-24T10:20:00+08:00
draft = false
author = ""
keywords = ["gitlab", "kubernetes", "helm", "ceph", "rook", "安装", "对象存储"]
summary = "使用 Helm Chart 在 Kubernetes 中部署 GitLab CE 的完整过程，含 Ceph/Rook 对象存储、外部 PostgreSQL/Redis、TLS、Runner 与 KAS 的详细配置。"
tags = ["gitlab", "kubernetes", "helm", "install"]
+++

# GitLab 安装 · Kubernetes 部署

在 Kubernetes 中使用官方 Helm Chart 部署 GitLab。相比 Omnibus/Docker，K8s 部署最复杂，需要提前规划存储、数据库与网络。本系列文档用 **gitlab-k8s** 简称此部署方式。

> 官方默认配置仅适用于 PoC/测试环境。生产环境必须使用外部 PostgreSQL、Redis 与对象存储。所有域名、IP、Secret、集群名称均为占位符。

<!--more-->

---

## 一、组件概述

webservice 负责「前台」同步交互，sidekiq 负责「后台」异步处理，两者共享同一套代码库但角色不同：

| 组件 | 角色 | 运行服务 | 处理内容 | 交互模式 |
| --- | --- | --- | --- | --- |
| **Webservice** | 同步 Web 层 | Puma (Rails) | 网页、API、GraphQL、Git HTTP | 用户/系统 ↔ Webservice（即时响应） |
| **Sidekiq** | 异步任务层 | Sidekiq Worker | 邮件、CI 调度、数据导入、镜像同步 | Webservice → Redis → Sidekiq（解耦执行） |

两者通过 Redis 队列解耦：webservice 投递任务到 Redis 队列，sidekiq 持续监听并消费；同时都需访问 PostgreSQL（数据库）与 Gitaly（仓库存储）。

> 这也解释了为何不建议为 webservice 和 sidekiq 同时挂载 NFS PVC——它们在 K8s 中通常是多副本，NFS 并发写存在锁竞争与一致性问题。应通过 Redis 队列传递任务、通过对象存储共享文件，实现无状态、可扩展的设计。

---

## 二、安装准备

### 2.1 前提条件

- Kubernetes 集群：版本通常在 1.16 到 1.28 之间。
- 已安装 `kubectl` 与 **Helm v3.10.3+**（Helm v3 必需）。
- 已安装 Ingress Controller（GitLab 需 Ingress 暴露服务）。
- 内存至少 10G。
- 生产环境必须使用**外部 PostgreSQL、Redis 与对象存储**（默认内置组件不适合生产）。

### 2.2 添加 Helm 仓库

```bash
# 国际用户：官方仓库
helm repo add gitlab https://charts.gitlab.io/
# 国内用户：极狐 GitLab（中国版）
helm repo add gitlab-jh https://charts.gitlab.cn

helm repo update
# 查看可用版本
helm search repo gitlab/gitlab --versions | grep 18.1.2
helm show values gitlab/gitlab --version 9.1.2
helm pull gitlab/gitlab --version 9.1.2
```

### 2.3 后端存储架构设计

利用 **Ceph RBD 块存储**承载有状态核心服务（Gitaly / PostgreSQL / Redis），用 **Ceph RGW（S3 兼容）** 承载对象数据（Registry / Artifacts / LFS / Uploads / Packages / Backups），**NFS** 专为 Toolbox 提供备份恢复所需的共享持久卷。

| GitLab 组件 | 数据特性 | 推荐存储后端 | K8s 存储方式 | 访问模式 |
| --- | --- | --- | --- | --- |
| Gitaly | Git 仓库，小文件多，低延迟 | Ceph RBD | PVC (StorageClass) | ReadWriteOnce |
| PostgreSQL | 关系型数据库，事务性强 | Ceph RBD | PVC (StorageClass) | ReadWriteOnce |
| Redis | 缓存/会话 | Ceph RBD | PVC (StorageClass) | ReadWriteOnce |
| Registry | 容器镜像，大文件，多副本读 | Ceph RGW(S3) 或 NFS | 对象存储 / PVC | ReadWriteMany（若用 NFS） |
| Artifacts/LFS/Uploads | CI 产物、大附件 | Ceph RGW(S3) 或 NFS | 对象存储 / PVC | ReadWriteMany（若用 NFS） |
| Backups (Toolbox) | 备份压缩包 | Ceph RGW(S3) 或 NFS | 对象存储 / PVC | ReadWriteMany（若用 NFS） |

> 关键限制：**Git 仓库（Gitaly）不能使用 NFS**（硬性限制）；Ceph RBD 只支持 ReadWriteOnce。需要多副本读取的对象数据优先使用 S3；若用 NFS 需确保 StorageClass 支持 ReadWriteMany。

### 2.4 生成自用证书

无证书会报 `x509: certificate is not valid for any names`。用 `cfssl` 为 `*.example.com` 生成通配符证书：

```bash
mkdir -p gitlab && cd gitlab
kubectl create namespace gitlab

# 生成服务器证书（带 SAN）
cfssl gencert \
  -ca=/opt/kubernetes/pki/ca.pem \
  -ca-key=/opt/kubernetes/pki/ca-key.pem \
  -config=ca-config.json \
  -hostname=<api-server>,kubernetes,kubernetes.default.svc,\
gitlab.example.com,registry.example.com,minio.example.com,kas.example.com,pages.example.com,*.pages.example.com,\
*.example.com,example.com \
  -profile=kubernetes gitlab-csr.json | cfssljson -bare gitlab
```

> TLS 注意：IP SAN 必须精确匹配（通配符 `192.168.*` 无效）；通配符 `*` 仅对 dNSName 有效。

确认证书 SAN 与 CA 匹配：

```bash
cfssl certinfo -cert gitlab.pem
# 应输出 DNS:*.example.com, DNS:example.com

kubectl get secret my-gitlab-tls -n gitlab -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -issuer -subject
```

创建 TLS Secret：

```bash
kubectl delete secret my-gitlab-tls -n gitlab
kubectl create secret tls my-gitlab-tls \
  --cert=gitlab.pem --key=gitlab-key.pem --namespace=gitlab
```

在 values.yaml 的 ingress 中指定：

```yaml
ingress:
  configureCertmanager: false
  tls:
    enabled: true
    secretName: my-gitlab-tls
```

### 2.5 创建 CephObjectStoreUser（Rook）

若使用 Rook 管理的 Ceph，创建 GitLab 专用用户：

```yaml
# gitlab-user.yaml
apiVersion: ceph.rook.io/v1
kind: CephObjectStoreUser
metadata:
  name: gitlab
  namespace: rook-ceph
spec:
  store: ceph-objectstore
  displayName: "GitLab User"
```

```bash
kubectl apply -f gitlab-user.yaml
# 查找 Rook 自动创建的 Secret
kubectl get secrets -n rook-ceph | grep object-user
```

从 Secret 提取凭证：

```bash
SECRET_NAME=rook-ceph-object-user-ceph-objectstore-gitlab
ACCESS_KEY=$(kubectl -n rook-ceph get secret $SECRET_NAME -o jsonpath='{.data.AccessKey}' | base64 --decode)
SECRET_KEY=$(kubectl -n rook-ceph get secret $SECRET_NAME -o jsonpath='{.data.SecretKey}' | base64 --decode)
ENDPOINT=$(kubectl -n rook-ceph get secret $SECRET_NAME -o jsonpath='{.data.Endpoint}' | base64 --decode)
```

> 若为原生 Ceph（非 Rook），用 `radosgw-admin user create --uid=gitlab-user ...` 创建。凭证为敏感信息，务必通过 Secret 传递，勿明文写入 values.yaml。

### 2.6 创建 S3 桶（ObjectBucketClaim）

GitLab 建议为不同数据类型创建独立桶：`gitlab-registry`、`gitlab-artifacts`、`gitlab-lfs`、`gitlab-uploads`、`gitlab-packages`。

```yaml
# gitlab-storage-obcs.yaml
apiVersion: objectbucket.io/v1alpha1
kind: ObjectBucketClaim
metadata:
  name: gitlab-lfs-obc
  namespace: gitlab
spec:
  bucketName: gitlab-lfs
  storageClassName: ceph-bucket
---
apiVersion: objectbucket.io/v1alpha1
kind: ObjectBucketClaim
metadata:
  name: gitlab-artifacts-obc
  namespace: gitlab
spec:
  bucketName: gitlab-artifacts
  storageClassName: ceph-bucket
---
# uploads / packages 同理
```

```bash
kubectl apply -f gitlab-storage-obcs.yaml
kubectl get obc -n gitlab   # 等待 PHASE 变为 Bound
```

OBC 创建后，Rook 自动生成同名 Secret（含 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`）与 ConfigMap（含 `BUCKET_HOST`、`BUCKET_NAME`）。需从其中提取凭证并**手工构建 GitLab 的 connection Secret**（Rook 生成的 Secret 只有两个 key，格式与 GitLab 期望的 YAML 不同）：

```bash
ACCESS_KEY=$(kubectl get secret gitlab-lfs-obc -n gitlab -o jsonpath='{.data.AWS_ACCESS_KEY_ID}' | base64 -d)
SECRET_KEY=$(kubectl get secret gitlab-lfs-obc -n gitlab -o jsonpath='{.data.AWS_SECRET_ACCESS_KEY}' | base64 -d)
BUCKET_HOST=$(kubectl get cm gitlab-lfs-obc -n gitlab -o jsonpath='{.data.BUCKET_HOST}')

cat > object-storage-connection.yaml <<EOF
provider: AWS
region: us-east-1
host: ${BUCKET_HOST}
endpoint: http://${BUCKET_HOST}
path_style: true
aws_access_key_id: ${ACCESS_KEY}
aws_secret_access_key: ${SECRET_KEY}
EOF

kubectl create secret generic gitlab-storage-connection \
  --from-file=connection=object-storage-connection.yaml -n gitlab
```

### 2.7 准备镜像（内网离线）

内网无法直连外网时，先将 GitLab 相关镜像同步到内网 Harbor：

```bash
for img in kubectl gitlab-base certificates gitaly gitlab-exporter \
  gitlab-shell gitlab-kas gitlab-container-registry gitlab-sidekiq-ce \
  gitlab-toolbox-ce gitlab-webservice-ce gitlab-workhorse-ce gitlab-pages; do
  ctr -n k8s.io images pull --all-platforms registry.gitlab.com/gitlab-org/build/cng/${img}:v18.1.2
  ctr -n k8s.io images tag registry.gitlab.com/gitlab-org/build/cng/${img}:v18.1.2 \
    <harbor-registry>/mirror/registry.gitlab.com/gitlab-org/build/cng/${img}:v18.1.2
  ctr -n k8s.io images push --plain-http --user <harbor-user>:<harbor-password> \
    <harbor-registry>/mirror/registry.gitlab.com/gitlab-org/build/cng/${img}:v18.1.2
done
```

> 镜像清单包括：kubectl、gitlab-base、certificates、gitaly、gitlab-exporter、gitlab-shell、gitlab-kas、gitlab-container-registry、gitlab-sidekiq-ce、gitlab-toolbox-ce、gitlab-webservice-ce、gitlab-workhorse-ce、gitlab-pages、gitlab-runner、gitlab-runner-helper、ingress-nginx/controller、postgresql、redis、redis-exporter、prometheus 等。

---

## 三、自定义 gitlab 配置

### 3.1 使用社区版（CE）与暴露方式

```yaml
global:
  edition: ce          # 社区版
  hosts:
    domain: example.com
    https: true
  ingress:
    configureCertmanager: false
    tls:
      enabled: true
      secretName: my-gitlab-tls
```

### 3.2 关闭内置 MinIO 与对象存储

```yaml
global:
  minio:
    enabled: false
  appConfig:
    object_store:
      enabled: false
    lfs:
      enabled: false
      bucket: git-lfs
    artifacts:
      enabled: false
      bucket: gitlab-artifacts
    uploads:
      enabled: false
      bucket: gitlab-uploads
    packages:
      enabled: false
      bucket: gitlab-packages
```

> `object_store.enabled: false` 关闭统一对象存储，GitLab 回退到本地文件系统路径。注意：`enabled` 是「功能开关」而非「存储开关」——设为 false 会直接禁用对应功能（LFS/Artifacts/Packages 上传接口返回 405），而非「改用 NFS」。要绕过 Helm 的 connection 强制校验并保持功能可用，只能配置对象存储。

### 3.3 核心状态数据使用 Ceph RBD

```yaml
gitlab:
  gitaly:
    persistence:
      enabled: true
      storageClass: ceph-block
      size: 80Gi
  postgresql:
    persistence:
      enabled: true
      storageClass: ceph-block
      size: 32Gi
  redis:
    persistence:
      enabled: true
      storageClass: ceph-block
      size: 8Gi
```

### 3.4 LFS / Uploads / Artifacts / Packages 使用对象存储

**为什么不能用 NFS**：Helm Chart 架构上只支持对象存储存放 Artifacts，用 NFS 挂载本地 PVC 会导致 CI Job 上传 artifacts 报 `405 Method Not Allowed`，Page 网站无法部署。根本原因是 `enabled: false` 会关闭 Rails 应用层的 API 路由，而非把存储指向 NFS。

启用类型特定对象存储：

```yaml
global:
  minio:
    enabled: false
  appConfig:
    object_store:
      enabled: false        # 使用类型特定配置
    lfs:
      enabled: true
      bucket: gitlab-lfs
      connection: { secret: gitlab-storage-connection, key: connection }
    artifacts:
      enabled: true
      bucket: gitlab-artifacts
      connection: { secret: gitlab-storage-connection, key: connection }
    uploads:
      enabled: true
      bucket: gitlab-uploads
      connection: { secret: gitlab-storage-connection, key: connection }
    packages:
      enabled: true
      bucket: gitlab-packages
      connection: { secret: gitlab-storage-connection, key: connection }
```

> bucket 的值必须与 OBC 的 bucketName / ConfigMap 的 BUCKET_NAME 完全一致。若之前配置了 NFS extraVolumes，启用对象存储后可移除。

### 3.5 Toolbox 备份后端

当 `global.minio.enabled` 和 `object_store.enabled` 都为 false 时，`toolbox.backups.objectStorage.config.secret` 是**必填项**，否则 Helm 校验会中止部署。可用「虚拟 S3 Secret + 本地文件备份」满足校验、同时把备份写到 NFS：

```yaml
gitlab:
  toolbox:
    persistence:
      enabled: true
      storageClass: nfs-shared
      accessMode: ReadWriteMany
      size: 100Gi
    backups:
      objectStorage:
        config:
          secret: gitlab-toolbox-s3cfg-dummy   # 仅为通过校验
          key: config
```

手动备份到本地路径：

```bash
kubectl exec -it -n gitlab $TOOLBOX_POD -- backup-utility \
  -f file:///srv/gitlab/tmp/backups/my-gitlab-backup.tar
```

恢复时同样用 `-f` 指定 NFS 路径：`backup-utility --restore -f file:///srv/gitlab/tmp/backups/my-gitlab-backup.tar`。

### 3.6 Registry 后端存储（S3 优先）

Registry 用 NFS filesystem 驱动时，多副本并发写同一 blob 会因缺乏分布式锁导致**数据损坏**。生产环境必须用 S3：

```yaml
# registry-storage.yaml
s3:
  accesskey: <ACCESS_KEY>
  secretkey: <SECRET_KEY>
  bucket: gitlab-registry
  region: us-east-1
  regionendpoint: http://<BUCKET_HOST>
  path_style: true
  v4auth: true
```

```bash
kubectl create secret generic registry-storage \
  --from-file=config=registry-storage.yaml -n gitlab
```

```yaml
global:
  registry:
    bucket: gitlab-registry
registry:
  storage:
    secret: registry-storage
    key: config
```

### 3.7 禁用内置 Prometheus

```yaml
prometheus:
  install: false
```

### 3.8 连接外部 Redis（Valkey）

```bash
kubectl create secret generic gitlab-valkey-auth \
  --from-literal=password='<valkey-password>' -n gitlab
kubectl create secret generic gitlab-valkey-sentinel-auth \
  --from-literal=redis-sentinel-password='<sentinel-password>' -n gitlab
```

```yaml
redis:
  install: false
global:
  redis:
    host: "<valkey-service>"
    auth:
      enabled: true
      secret: gitlab-valkey-auth
      key: password
    sentinelAuth:
      enabled: true
      secret: gitlab-valkey-sentinel-auth
      key: redis-sentinel-password
    sentinels:
      - host: <valkey-sentinel-svc>.default.svc.cluster.local
        port: 26379
```

验证：确认无 `my-gitlab-redis-*` Pod，webservice/sidekiq 日志无 Redis 连接错误，并放行 26379/6379 端口网络策略。

### 3.9 连接外部 PostgreSQL（单库 + PgBouncer）

**分库 vs 单库**：分库（Separate Databases）仍是**实验性**功能，官方明确「not ready for production use」，且不可回退、不支持 PgBouncer/HA。**单库是默认且生产就绪的推荐方案**。

创建用户与数据库：

```bash
GITLAB_PASSWD=$( openssl rand -base64 24 )
kubectl exec -it pg-cluster-postgresql-0 -n default -- \
  psql "postgresql://postgres:$PG_PASSWD@<pgbouncer-svc>:6432/postgres" -c \
  "CREATE USER gitlab WITH PASSWORD '$GITLAB_PASSWD';"
kubectl exec -i pg-cluster-postgresql-0 -n default -- \
  psql "postgresql://postgres:$PG_PASSWD@<pgbouncer-svc>:6432/postgres" -c \
  "CREATE DATABASE gitlabhq_production OWNER gitlab;"
kubectl exec -it pg-cluster-postgresql-0 -n default -- \
  psql "postgresql://postgres:$PG_PASSWD@<pgbouncer-svc>:6432/gitlabhq_production" -c \
  "GRANT ALL ON SCHEMA public TO gitlab; ALTER SCHEMA public OWNER TO gitlab;"
# 预装扩展（amcheck 非 trusted，需超级用户）
kubectl exec -it pg-cluster-postgresql-0 -n default -- \
  psql "postgresql://postgres:$PG_PASSWD@<pgbouncer-svc>:6432/gitlabhq_production" -c \
  "CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS btree_gist; CREATE EXTENSION IF NOT EXISTS amcheck;"
```

创建密码 Secret 并配置：

```bash
kubectl create secret generic gitlab-pg-password \
  --from-literal=password=$GITLAB_PASSWD -n gitlab
```

```yaml
postgresql:
  install: false
global:
  psql:
    host: <pgbouncer-svc>.default.svc.cluster.local
    port: 6432
    database: gitlabhq_production
    username: gitlab
    password:
      secret: gitlab-pg-password
      key: password
    preparedStatements: false   # PgBouncer transaction 池模式兼容
    sslMode: disable
gitlab:
  migrations:
    psql:
      host: <postgresql-primary-svc>.default.svc.cluster.local
      port: 5432
  toolbox:
    psql:
      host: <postgresql-primary-svc>.default.svc.cluster.local
      port: 5432
```

> 关键点：应用连接走 PgBouncer 6432；migrations 与 toolbox 直连 5432（DDL 和 pg_dump 在 transaction 池下不可靠）；`preparedStatements: false` 是使用 PgBouncer 的强制要求；PgBouncer 需 `pool_mode = transaction` 且 `max_prepared_statements > 0`。

---

## 四、安装部署

```bash
helm upgrade --install my-gitlab gitlab/gitlab \
  --namespace gitlab \
  --create-namespace \
  --timeout 600s \
  --values ./gitlab/gitlab/my-gitlab.yaml
```

安装时若 gitaly PVC 无法生成 PV，检查：

```bash
helm get values my-gitlab -n gitlab
kubectl get events -n gitlab --sort-by='.lastTimestamp' | tail -20
```

### 4.1 查看 Pod 状态

```bash
kubectl get pod -n gitlab
```

关键检查项：核心 Pod 均为 `Running`；`migrations` Job 为 `Completed`；证书 SAN 匹配 Ingress 域名；核心 PVC 用 `ceph-block`，共享/备份 PVC 用预期 StorageClass；Registry 的 S3 Secret 已挂载。

### 4.2 验证与登录

```bash
kubectl get secret my-gitlab-tls -n gitlab -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -text -noout | grep -A1 "Subject Alternative Name"
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=50
```

### 4.3 生产注意事项

- 必须连接外部高可用 PostgreSQL、Redis 与对象存储。
- 建议遵循 Cloud Native Hybrid 参考架构。
- Gitaly 标记为「仅评估用途」，生产应运行在集群外部 VM/物理机上。
- PostgreSQL 最低版本 14。
- 内置 Runner 默认无 privileged，无法使用 DinD。

### 4.4 卸载（谨慎）

```bash
helm uninstall my-gitlab -n gitlab
```

---

## 五、配置 GitLab Runner

### 5.1 解决 DNS 解析与证书信任

Runner Pod 在集群内无法解析自定义域名（CoreDNS 只认 `*.svc.cluster.local`），且自签证书不被信任。两类问题分别处理：

**DNS 解析**（推荐用 Ingress Controller 的 ClusterIP，而非 MetalLB EXTERNAL-IP）：

```bash
kubectl get svc -n gitlab my-gitlab-nginx-ingress-controller \
  -o jsonpath='{.spec.clusterIP}'; echo
```

```yaml
gitlab-runner:
  hostAliases:
    - ip: "<ingress-clusterip>"
      hostnames: ["gitlab.example.com"]
```

**证书信任**（挂载 CA 证书）：

```bash
kubectl create secret generic gitlab-runner-ca \
  --from-file=ca.crt=/opt/kubernetes/pki/ca.pem -n gitlab
```

```yaml
gitlab-runner:
  certsSecretName: gitlab-runner-ca
  runners:
    config: |
      [[runners]]
        tls-ca-file = "/home/gitlab-runner/.gitlab-runner/certs/ca.crt"
        [runners.kubernetes]
          [[runners.kubernetes.host_aliases]]
            ip = "<ingress-clusterip>"
            hostnames = ["gitlab.example.com"]
```

> 版本要求：`host_aliases` 需 GitLab Runner 13.7+。生产环境**不要**用 `tls_verify = false` 关闭证书校验。

### 5.2 配置持久化缓存（S3 / Ceph RGW）

生产环境推荐 Ceph RGW（S3）：无文件锁竞争、原子操作保证一致性，适合多 Runner 高并发。NFS/CephFS 受限于 POSIX 锁与性能瓶颈。

```yaml
# gitlab-runner-cache-obc.yaml
apiVersion: objectbucket.io/v1alpha1
kind: ObjectBucketClaim
metadata:
  name: gitlab-runner-cache-obc
  namespace: gitlab
spec:
  bucketName: gitlab-runner-cache
  storageClassName: ceph-bucket
```

```bash
kubectl apply -f gitlab-runner-cache-obc.yaml
ACCESS_KEY=$(kubectl get secret gitlab-runner-cache-obc -n gitlab -o jsonpath='{.data.AWS_ACCESS_KEY_ID}' | base64 -d)
SECRET_KEY=$(kubectl get secret gitlab-runner-cache-obc -n gitlab -o jsonpath='{.data.AWS_SECRET_ACCESS_KEY}' | base64 -d)
BUCKET_HOST=$(kubectl get cm gitlab-runner-cache-obc -n gitlab -o jsonpath='{.data.BUCKET_HOST}')

kubectl create secret generic s3access \
  --from-literal=accesskey="${ACCESS_KEY}" \
  --from-literal=secretkey="${SECRET_KEY}" -n gitlab
```

```yaml
gitlab-runner:
  runners:
    config: |
      [[runners]]
        [runners.cache]
          Type = "s3"
          Path = "gitlab-runner"
          Shared = true
          [runners.cache.s3]
            ServerAddress = "<BUCKET_HOST>"
            BucketName = "gitlab-runner-cache"
            BucketLocation = "us-east-1"
            Insecure = false
            AuthenticationType = "access-key"
  cache:
    secretName: s3access
```

> 生效前提：`.gitlab-ci.yml` 中必须声明 `cache:`。验证顺序：作业日志（`Using cache`）→ S3 桶内对象 → Runner 配置。

---

## 六、配置 KAS（GitLab Agent Server）

1. 确认 `global.kas.enabled = true` 且 KAS 域名正确。
2. 在项目 Operate > Kubernetes clusters 中注册 Agent，获取 Agent Token。
3. 部署 agentk：

```bash
kubectl create namespace gitlab-agent-<name>
kubectl create secret generic gitlab-agent-token \
  --namespace gitlab-agent-<name> \
  --from-literal=token='<agent-token>'
helm upgrade --install <agent-name> gitlab/gitlab-agent \
  --namespace gitlab-agent-<name> \
  --create-namespace \
  --set image.tag=v18.1.0 \
  --set config.token=<agent-token> \
  --set config.kasAddress=grpc://my-gitlab-kas.gitlab.svc.cluster.local:8150
```

> kasAddress 协议：KAS 内部默认未启用 TLS，用 `grpc://my-gitlab-kas.gitlab.svc.cluster.local:8150`；若启用了 TLS 用 `grpcs://`（注意证书 SAN 需包含内部 DNS）。也可走 Ingress `wss://kas.example.com`。

4.（可选）在仓库创建 `.gitlab/agents/<agent-name>/config.yaml` 授权访问。
5. 在 `.gitlab-ci.yml` 中使用 Agent 上下文执行 kubectl。

---

## 七、常见问题

| 问题 | 处理 |
| --- | --- |
| 证书错误 / SAN 不匹配 | 检查 Secret 证书 SAN 是否包含域名（`*.example.com`） |
| migrations Job 失败 | 查看日志；确认 PgBouncer 直连配置、扩展权限 |
| Artifacts 上传报 405 | 必须配置对象存储（不能仅用 NFS） |
| Registry 数据损坏风险 | 用 S3 后端，避免 NFS filesystem 驱动多副本并发写 |
| Runner 注册失败（DNS） | 用 Ingress ClusterIP + hostAliases / CoreDNS hosts |
| Runner 证书错误 | 挂载 CA 到 Runner，确认 SAN 覆盖域名 |
| PgBouncer prepared statement 错误 | 设 `preparedStatements: false` 或 `max_prepared_statements > 0` |
| 内置 MinIO 未关闭 | 关闭 minio 并用外部存储替代 |
| 升级路径错误（unsupported upgrade path） | `helm history my-gitlab -n gitlab` 查历史，`helm rollback my-gitlab <revision> -n gitlab` 回滚 |
| radosgw-admin bucket list 为空 | 多对象存储（zone）时需显式指定 `--rgw-realm/--rgw-zonegroup/--rgw-zone`，或用 OBC 凭证经 S3 API 验证 |
| gitaly PVC 无法生成 PV | `helm get values` 检查 gitaly 配置，`kubectl get events -n gitlab` 排查依赖 Secret 缺失 |

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [组件与集成配置]({{< ref "configuration" >}})。
