+++
title = "Kubernetes 监控与告警"
date = 2024-11-07T11:20:00+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "prometheus", "alertmanager", "grafana", "监控", "告警"]
summary = "用 kube-prometheus-stack 搭建 Kubernetes 监控告警底座，含 Cilium 指标合并、告警规则库、Alertmanager 持久化、Grafana 密码管理与集群组件指标抓取。"
tags = ["k8s", "kubernetes", "monitoring", "prometheus", "alertmanager", "grafana"]
+++

# Kubernetes 监控与告警

本文完整介绍用 **kube-prometheus-stack**（Prometheus Operator + Prometheus + Alertmanager + Grafana）搭建 Kubernetes 监控告警底座。所有 IP、StorageClass、密码、镜像仓库均为占位符。

<!--more-->

---

## 一、架构

```text
┌───────────────┐   scrape    ┌─────────────┐   rules    ┌──────────────┐
│ node-exporter │ ───────────▶ │  Prometheus  │ ─────────▶ │ Alertmanager │ ──▶ 邮件/Webhook
│ kube-state    │             └──────┬──────┘            └──────────────┘
│ cilium / etcd │                   │ 查询
│ apiserver 等  │                   ▼
└───────────────┘            ┌─────────────┐
                             │   Grafana    │
                             └─────────────┘
```

---

## 二、安装 kube-prometheus-stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update prometheus-community

helm pull prometheus-community/kube-prometheus-stack --version 92.17.0 --destination ./monitoring
tar -zxf ./monitoring/kube-prometheus-stack*.tgz -C ./monitoring
cp ./monitoring/kube-prometheus-stack/values.yaml ./monitoring/kube-prometheus-stack/my-prometheus-stack.yaml
```

---

## 三、Cilium 环境检查（KubeProxyReplacement）

```bash
# 方式一：直接询问 Cilium 运行模式
kubectl -n kube-system exec ds/cilium -- cilium-dbg status | grep KubeProxyReplacement
# 方式二：检查 kube-proxy Pod 是否已移除
kubectl get pods -n kube-system | grep kube-proxy
# 方式三：节点上检查 kube-proxy 进程
ps aux | grep kube-proxy
```

> `KubeProxyReplacement: True` 表示 Cilium 已替换 kube-proxy，此时 `kubeProxy` 规则组应关闭。

前置准备资源：

| 资源 | 是否必须 | 说明 |
| --- | --- | --- |
| etcd 客户端证书 Secret | ✅ 必须 | etcd 开 mTLS 时不创建则 kubeEtcd 抓取失败 |
| StorageClass | ✅ 必须 | 无默认 SC 时 PVC Pending |
| kube-root-ca.crt ConfigMap | ⚠️ 自动 | K8s ≥ 1.20 自动创建 |
| 镜像拉取 Secret | ⚠️ 视环境 | 离线/私有仓库必须 |
| Grafana 密码 Secret | 🔶 可选 | 不想明文写密码时 |

---

## 四、Cilium 的 ServiceMonitor 能被发现

```yaml
prometheus:
  prometheusSpec:
    serviceMonitorSelectorNilUsesHelmValues: false
    podMonitorSelectorNilUsesHelmValues: false
    probeSelectorNilUsesHelmValues: false
    ruleSelectorNilUsesHelmValues: false
    scrapeConfigSelectorNilUsesHelmValues: false
    serviceMonitorSelector: {}
    serviceMonitorNamespaceSelector: {}
    podMonitorSelector: {}
    podMonitorNamespaceSelector: {}
    probeSelector: {}
    probeNamespaceSelector: {}
    ruleSelector: {}
    ruleNamespaceSelector: {}

    retention: 60d
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: "<storage-class>"
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 80Gi
    resources:
      requests: { cpu: 200m, memory: 512Mi }
      limits: { cpu: 1000m, memory: 2Gi }
```

---

## 五、告警与记录规则库

```yaml
defaultRules:
  create: true
  rules:
    alertmanager: true
    etcd: true
    kubeApiserverAvailability: true
    kubeApiserverBurnrate: true
    kubeApiserverSlos: true
    kubeControllerManager: true
    kubelet: true
    kubeStateMetrics: true
    kubernetesApps: true
    kubernetesResources: true
    kubernetesStorage: true
    kubernetesSystem: true
    kubeSchedulerAlerting: true
    node: true
    nodeExporterAlerting: true
    prometheus: true
    prometheusOperator: true
    kubeProxy: false   # Cilium 替换了 kube-proxy
    windows: false     # 无 Windows 节点
```

> 核心原则：**只开启能实际采集到指标的组件对应规则组**，否则会产生大量 `absent()` 误报告警。`defaultRules.rules.xxx` 与抓取开关（`kubeEtcd.enabled` 等）相互独立，关闭某个组件时需两者同时关闭保持一致。

常见规则组含义：

| 规则组 | 核心关注点 |
| --- | --- |
| etcd | etcd 集群健康（`etcdServerHasNoLeader` 等） |
| kubeApiserver... | API Server 可用性与 SLO |
| kubernetesApps | `KubePodCrashLooping`、`KubeDeploymentReplicasMismatch` |
| nodeExporter... | `NodeFilesystemSpaceFillingUp` 等 |
| kubeScheduler... | `KubeSchedulerDown` |

---

## 六、Alertmanager 持久化

```yaml
alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: "<storage-class>"
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 32Gi
```

---

## 七、Grafana 定制

### 7.1 密码三种模式

| 模式 | 说明 |
| --- | --- |
| 模式一：明文 adminPassword | 测试环境；密码进 Release Secret，不安全 |
| 模式二：不填（随机生成） | 安装后需从 Secret 取 |
| 模式三：existingSecret（推荐） | 密码不进 Helm values，可配合 Sealed Secrets/Vault |

```yaml
# 模式三（推荐）
grafana:
  admin:
    existingSecret: grafana-admin
    userKey: admin-user
    passwordKey: admin-password

# 手动创建 Secret
kubectl -n monitoring create secret generic grafana-admin \
  --from-literal=admin-user=admin \
  --from-literal=admin-password='<密码>'
```

获取密码 / 修改密码：

```bash
kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
# 改密码：更新 Secret 后重启
kubectl -n monitoring rollout restart deployment prometheus-stack-grafana
```

> 注意：`adminUser`（用户名值）与 `admin.userKey`（Secret 中用户名字段名）不是一回事。

### 7.2 持久化与 dashboards

```yaml
grafana:
  service:
    type: NodePort
    port: 80
    targetPort: 3000
    nodePort: 30300
  persistence:
    enabled: true
    type: sts
    storageClassName: "<storage-class>"
    accessModes: [ReadWriteOnce]
    size: 10Gi
  sidecar:
    dashboards:
      enabled: true
      label: grafana_dashboard
      labelValue: "1"
      searchNamespace: ALL
  multicluster:
    global:
      enabled: false   # 单集群保持 false
    etcd:
      enabled: false
```

> `multicluster` 控制 Grafana 预置仪表盘是否显示「集群选择器」，单集群场景保持 false。

---

## 八、集群组件指标抓取

### 8.1 托管 vs 自建 K8s

| 维度 | 自建 K8s（kubeadm/二进制） | 托管 K8s（EKS/ACK 等） |
| --- | --- | --- |
| 控制平面 Pod | 集群内可见 | 云厂商独立管理，集群内不存在 |
| 能否 SSH | 能 | 不能 |
| 指标暴露 | 默认绑定 127.0.0.1，需手动改为 0.0.0.0 | 即使有也不可达 |

**判断该不该关**：

```bash
# 1. 控制平面 Pod 在不在集群里
kubectl get pods -n kube-system | grep -E 'etcd|controller-manager|scheduler'
# 2. master 节点是否由你管理
kubectl get nodes -l node-role.kubernetes.io/control-plane
# 3. kube-proxy 是否被替换
kubectl get pods -n kube-system | grep kube-proxy
```

托管 K8s 关闭（否则产生大量 target down 噪声）：

```yaml
kubeEtcd:
  enabled: false
kubeControllerManager:
  enabled: false
kubeScheduler:
  enabled: false
```

### 8.2 etcd 指标暴露（mTLS）

etcd metrics 默认「搭便车」在客户端 2379 端口，继承了 mTLS 认证。需创建客户端证书 Secret：

```bash
kubectl -n monitoring create secret generic etcd-client-certs \
  --from-file=ca.crt=/etc/kubernetes/pki/etcd/ca.crt \
  --from-file=client.crt=/etc/kubernetes/pki/etcd/healthcheck-client.crt \
  --from-file=client.key=/etc/kubernetes/pki/etcd/healthcheck-client.key

# values.yaml 中挂载
prometheus:
  prometheusSpec:
    secrets:
      - etcd-client-certs
```

二进制部署配置：

```yaml
kubeEtcd:
  enabled: true
  endpoints:
    - <etcd节点IP1>
    - <etcd节点IP2>
    - <etcd节点IP3>
  service:
    port: 2381
    targetPort: 2381
  serviceMonitor:
    scheme: https
    tlsConfig:
      caFile: /etc/prometheus/secrets/etcd-client-certs/ca.crt
      certFile: /etc/prometheus/secrets/etcd-client-certs/client.crt
      keyFile: /etc/prometheus/secrets/etcd-client-certs/client.key
      insecureSkipVerify: false
```

### 8.3 kube-apiserver 指标暴露

默认通过集群内 `kubernetes.default.svc:443` 抓取，用 Prometheus SA Token 认证。需确认 apiserver 证书 SAN 含 `kubernetes`：

```bash
openssl x509 -in /opt/kubernetes/pki/apiserver.pem -noout -text | grep -A2 "Subject Alternative Name"
# 输出含 DNS:kubernetes 则默认配置可用；否则覆盖 tlsConfig
```

### 8.4 controller-manager 指标暴露

需在 systemd unit 的 ExecStart 补认证参数（复用 controller-manager kubeconfig）：

```bash
--authentication-kubeconfig=/opt/kubernetes/etc/controller-manager.kubeconfig \
--authorization-kubeconfig=/opt/kubernetes/etc/controller-manager.kubeconfig
systemctl daemon-reload && systemctl restart kube-controller-manager
```

```yaml
kubeControllerManager:
  enabled: true
  endpoints:
    - <masterIP1>
    - <masterIP2>
    - <masterIP3>
  service:
    port: 10257
    targetPort: 10257
  serviceMonitor:
    enabled: true
    https: true
    insecureSkipVerify: true
```

### 8.5 scheduler 指标暴露

需改 `--bind-address=0.0.0.0` 并补认证参数：

```bash
--bind-address=0.0.0.0 \
--authentication-kubeconfig=/opt/kubernetes/etc/scheduler.kubeconfig \
--authorization-kubeconfig=/opt/kubernetes/etc/scheduler.kubeconfig
systemctl daemon-reload && systemctl restart kube-scheduler
```

```yaml
kubeScheduler:
  enabled: true
  endpoints:
    - <masterIP1>
    - <masterIP2>
    - <masterIP3>
  service:
    port: 10259
    targetPort: 10259
  serviceMonitor:
    enabled: true
    https: true
    insecureSkipVerify: true
```

---

## 九、执行安装

### 9.1 准备镜像（内网离线）

同步 kube-webhook-certgen、node-exporter、prometheus-operator、k8s-sidecar、grafana、kube-state-metrics、prometheus 等镜像到内网仓库。

### 9.2 开始安装

```bash
helm upgrade --install kube-prometheus-stack ./monitoring/kube-prometheus-stack \
  -f ./monitoring/kube-prometheus-stack/my-prometheus-stack.yaml \
  --namespace monitoring \
  --create-namespace
```

### 9.3 安装后验证

```bash
# 确认 Cilium 的 ServiceMonitor 存在
kubectl get servicemonitor -A | grep cilium
# Prometheus UI → Status → Targets 里搜索 cilium / etcd / apiserver，应看到 UP
```

---

## 十、调试容器

kube-prometheus-stack 默认用 distroless 镜像（无 Shell），可用 `kubectl debug` 注入调试容器：

| 镜像 | 体积 | 定位 | 内置工具 |
| --- | --- | --- | --- |
| nicolaka/netshoot | ~200MB | 网络排障瑞士军刀 | tcpdump/tshark/nmap/iperf3/mtr/grpcurl |
| DebugBox (Power) | ~91MB | 深度取证 | tshark/ngrep/iptables/nftables/ltrace |
| DebugBox (Balanced) | ~47MB | 日常排障默认选择 | curl/dig/tcpdump/strace/nmap/vim |
| KoolKits | 因语言而异 | 语言专家 | JVM async-profiler 等 |
| busybox/alpine | ~1-7MB | 极简 Shell | sh/ls/wget/nc |

```bash
kubectl debug -n monitoring prometheus-kube-prometheus-stack-prometheus-0 \
  -it --target=prometheus \
  --image=<harbor>/mirror/debugbox:power-1.2.0 -- /bin/bash
```

> 选择：深度网络排障选 netshoot；日常排障选 DebugBox Balanced；语言运行时分析选 KoolKits；极简 Shell 选 busybox。

---

## 十一、开启网络组件指标跟踪（Cilium ServiceMonitor）

```bash
helm upgrade --install cilium /opt/kubernetes/deploy/cilium/ --namespace kube-system \
  --set hubble.relay.enabled=true \
  --set hubble.ui.enabled=true \
  --set prometheus.enabled=true \
  --set operator.prometheus.enabled=true \
  --set hubble.enabled=true \
  --set hubble.metrics.enabled="{dns,drop,tcp,flow,port-distribution,icmp,http}" \
  --set hubble.metrics.serviceMonitor.enabled=true \
  --set ipv6.enabled=false \
  --set operator.replicas=1
```

> 关键：`prometheus.serviceMonitor.enabled`（Agent 9962）、`operator.prometheus.serviceMonitor.enabled`（Operator 9963）、`hubble.metrics.serviceMonitor.enabled`（Hubble 9965）。
> 踩坑：`serviceMonitorSelectorNilUsesHelmValues` 若为 true，`serviceMonitorSelector: {}` 会被 Helm 自动填充 `release: <name>` 标签，导致 Cilium 的 SM 被忽略。务必显式设 false。

### 安装后验证 Cilium 指标

```bash
kubectl get servicemonitor -A | grep cilium
kubectl get prometheus -n monitoring -o yaml | grep -A3 serviceMonitorSelector
# Prometheus UI → Targets 搜 cilium，应 UP
# Graph 查询：cilium_unreachable_nodes、hubble_tcp_flags_total
```

---

## 十二、配置访问（暴露策略）

核心原则：**Grafana 作为唯一需暴露的入口；Prometheus/Alertmanager 无内置认证，避免直接暴露**。

| 组件 | 生产推荐策略 | 暴露方式 |
| --- | --- | --- |
| Grafana | 暴露（统一门户） | Ingress/Gateway API |
| Prometheus | 不直接暴露 | ClusterIP + port-forward / Grafana |
| Alertmanager | 通常不暴露 | ClusterIP + port-forward |

```yaml
grafana:
  ingress:
    enabled: true
    ingressClassName: "nginx"
    hosts:
      - "grafana.example.com"
```

---

## 十三、安装单独的 Alertmanager

### 13.1 获取 Chart

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm pull prometheus-community/alertmanager --version 2.1.4 --destination ./monitoring
```

### 13.2 参数定制

```yaml
replicaCount: 1              # 高可用改 3
service:
  type: NodePort
  port: 9093
  nodePort: 30903
persistence:
  enabled: true
  storageClass: "<storage-class>"
  accessModes: [ReadWriteOnce]
  size: 8Gi
resources:
  requests: { cpu: 50m, memory: 64Mi }
  limits: { cpu: 200m, memory: 256Mi }
config:
  global:
    resolve_timeout: 5m
  route:
    receiver: 'default'
    group_by: ['alertname', 'namespace']
    group_wait: 30s
    group_interval: 5m
    repeat_interval: 4h
    routes:
      - matchers:
          - severity = critical
        receiver: 'critical'
        repeat_interval: 1h
        continue: true
  receivers:
    - name: 'default'
      webhook_configs:
        - url: 'http://<webhook>/alert'
          send_resolved: true
    - name: 'critical'
      webhook_configs:
        - url: 'http://<critical-webhook>/alert'
          send_resolved: true
```

### 13.3 与 Prometheus 集成

修改 Prometheus `prometheus.yml` 的 `alerting` 段：

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - "my-alertmanager.cilium-monitoring.svc.cluster.local:9093"
```

### 13.4 安装

```bash
helm install my-alertmanager ./monitoring/alertmanager \
  -f ./monitoring/alertmanager/my-alertmanager.yaml \
  --namespace cilium-monitoring --create-namespace
```

> 注意：StatefulSet 创建后，`storageClass`/`serviceName`/`volumeClaimTemplates` 属**不可变字段**，不能用 `helm upgrade` 原地修改（会报 `updates to statefulset spec for fields other than ... are forbidden`），需卸载重装。
> 离线：Chart 包不含镜像，需先 docker pull/save 镜像，导入私有仓库后在 values 中指定 image.repository。

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航。
