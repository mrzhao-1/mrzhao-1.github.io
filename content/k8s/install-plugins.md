+++
title = "Kubernetes 集群插件与 Helm"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "helm", "插件", "cilium", "coredns", "ingress", "镜像"]
summary = "安装 Helm，并部署 CNI（Cilium）、CoreDNS、Metrics Server、Dashboard、ingress-nginx 等集群插件，含内网镜像获取与保存。"
tags = ["k8s", "kubernetes", "helm", "plugins", "cilium", "coredns", "ingress"]
+++

# Kubernetes 集群插件与 Helm

本文介绍集群插件（CNI、CoreDNS、Metrics Server、Dashboard、ingress-nginx 等）的镜像获取、Helm 安装与部署，以及集群验证。所有 IP、域名、主机名、镜像仓库均为占位符。

<!--more-->

---

## 一、镜像获取与保存

内网离线环境下，先用 docker 拉取插件镜像，再 `docker save` 保存、`gzip` 压缩，待部署时 `ctr --namespace k8s.io image import` 导入。

### 1.1 Cilium 相关镜像

```bash
docker pull quay.io/cilium/cilium:v1.17.1
docker pull quay.io/cilium/certgen:v0.2.1
docker pull quay.io/cilium/hubble-relay:v1.17.1
docker pull quay.io/cilium/hubble-ui-backend:v0.13.1
docker pull quay.io/cilium/hubble-ui:v0.13.1
docker pull quay.io/cilium/cilium-envoy:v1.31.5-xxx
docker pull quay.io/cilium/operator:v1.17.1
docker pull quay.io/cilium/startup-script:xxx
docker pull quay.io/cilium/clustermesh-apiserver:v1.17.1
docker pull docker.io/library/busybox:1.37.0
docker pull ghcr.io/spiffe/spire-agent:1.9.6
docker pull ghcr.io/spiffe/spire-server:1.9.6

docker save quay.io/cilium/cilium:v1.17.1 -o cilium-v1.17.1.tar
docker save quay.io/cilium/certgen:v0.2.1 -o certgen-v0.2.1.tar
# ... 其余镜像同理 docker save

gzip cilium-v1.17.1.tar
# ... 其余同理 gzip
```

### 1.2 监控插件镜像

```bash
docker pull grafana/grafana:9.3.6
docker pull prom/prometheus:v2.42.0
docker save grafana/grafana:9.3.6 -o grafana-9.3.6.tar
docker save prom/prometheus:v2.42.0 -o prometheus-v2.42.0.tar
gzip grafana-9.3.6.tar prometheus-v2.42.0.tar
```

### 1.3 CoreDNS / Metrics Server / Dashboard 镜像

```bash
docker pull registry.example.com/chenby/coredns:v1.11.4
docker save registry.example.com/chenby/coredns -o coredns-v1.11.4.tar

docker pull k8s.example.com/metrics-server/metrics-server:v0.7.2
docker save k8s.example.com/metrics-server/metrics-server:v0.7.2 -o metrics-server-v0.7.2.tar
# 或 ctr -n k8s.io images export metrics-server-v0.7.2.tar <镜像>

docker pull kubernetesui/dashboard-auth:1.2.3
docker pull kubernetesui/dashboard-api:1.10.2
docker pull kubernetesui/dashboard-web:1.6.1
docker pull kubernetesui/dashboard-metrics-scraper:1.2.2
docker pull library/kong:3.8
```

### 1.4 ingress-nginx 镜像

```bash
docker pull k8s.m.daocloud.io/ingress-nginx/controller:v1.12.0
docker pull k8s.m.daocloud.io/ingress-nginx/kube-webhook-certgen:v1.5.0
docker pull k8s.m.daocloud.io/defaultbackend-amd64:1.5
docker save k8s.m.daocloud.io/ingress-nginx/controller:v1.12.0 -o ingress-nginx-controller-v1.12.0.tar
# ... 其余同理
ctr --namespace k8s.io image import ingress-nginx-controller-v1.12.0.tar
```

### 1.5 导入镜像（部署时）

```bash
for img in <镜像列表>; do
  cp /@snapshots/data/images/${img}.tar.gz /dev/shm
  gzip -d /dev/shm/${img}.tar.gz
  ctr --namespace k8s.io image import /dev/shm/${img}.tar
  rm -rf /dev/shm/${img}.tar
done
```

---

## 二、安装 Helm

```bash
wget https://mirrors.huaweicloud.com/helm/v3.17.2/helm-v3.17.2-linux-amd64.tar.gz

# 分发到各节点
for host in <节点列表>; do
  scp helm-v3.17.2-linux-amd64.tar.gz root@${host}:/tmp/
  ssh root@${host} "tar xvf /tmp/helm-*-linux-amd64.tar.gz -C /tmp && cp /tmp/linux-amd64/helm /opt/kubernetes/bin/"
done

helm completion bash > /etc/bash_completion.d/helm
```

---

## 三、部署 CNI（Cilium）

```bash
helm repo add cilium https://helm.cilium.io
cd /opt/kubernetes/deploy
tar xvf cilium-*.tgz -C /opt/kubernetes/deploy

# 修改 values.yaml：useDigest: false，hubble-relay 镜像源，confPath 指向 CNI 目录

# 方式一：启用路由与监控（推荐）
helm upgrade --install cilium /opt/kubernetes/deploy/cilium/ --namespace kube-system \
  --set hubble.relay.enabled=true \
  --set hubble.ui.enabled=true \
  --set prometheus.enabled=true \
  --set operator.prometheus.enabled=true \
  --set hubble.enabled=true \
  --set ipv6.enabled=false \
  --set operator.replicas=1

# 方式二：默认参数安装
helm install cilium ./cilium/ -n kube-system
```

验证：

```bash
kubectl get pod -A | grep cil
kubectl get svc -A | grep -E 'hubble|cilium'
```

### 3.1 部署 Cilium 监控面板

```bash
kubectl apply -f /opt/kubernetes/deploy/monitoring-example.yaml
# 将 grafana / prometheus / hubble-ui 的 svc 改为 NodePort
kubectl edit svc -n kube-system hubble-ui
kubectl edit svc -n cilium-monitoring grafana
kubectl edit svc -n cilium-monitoring prometheus
```

---

## 四、部署 CoreDNS

```bash
helm repo add coredns https://coredns.github.io/helm
helm pull coredns/coredns
tar -zxf /opt/kubernetes/deploy/coredns-*.tgz -C /opt/kubernetes/deploy

# 修改 values.yaml：clusterIP 指定为 service 网段的 DNS 地址（如 <service网段>.10），
# 并将 registry.k8s.io 替换为国内源
sed -i "s#registry.k8s.io/#<国内源>#g" /opt/kubernetes/deploy/coredns/values.yaml

helm install coredns /opt/kubernetes/deploy/coredns/ -n kube-system
```

---

## 五、部署 Metrics Server

```bash
# 方式一：helm
helm pull bitnami/metrics-server --version 7.3.5

# 方式二：直接下载 components.yaml
wget https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
sed -i "s#registry.k8s.io/#<国内源>#g" metrics-server.yaml

kubectl apply -f /opt/kubernetes/deploy/metrics-server.yaml
```

关键 args（在 Deployment 中配置）：

```yaml
args:
  - --cert-dir=/tmp
  - --secure-port=4443
  - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
  - --kubelet-use-node-status-port
  - --metric-resolution=15s
  - --kubelet-insecure-tls
  - --requestheader-client-ca-file=/opt/kubernetes/pki/front-proxy-ca.pem
```

验证：

```bash
kubectl top node
```

---

## 六、部署 Dashboard

```bash
# 离线：解压已下载的 tgz
tar -zxf /opt/kubernetes/deploy/kubernetes-dashboard-*.tgz -C /opt/kubernetes/deploy
helm upgrade --install kubernetes-dashboard /opt/kubernetes/deploy/kubernetes-dashboard/ \
  --create-namespace --namespace kube-system

# 改为 NodePort
kubectl edit svc -n kube-system kubernetes-dashboard-kong-proxy   # type: NodePort
```

创建管理员 ServiceAccount 与长期 token：

```yaml
# dashboard-user.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: admin-user
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: admin-user
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: admin-user
  namespace: kube-system
```

```bash
kubectl apply -f dashboard-user.yaml
# 生成长期 token
kubectl -n kube-system create token admin-user
```

---

## 七、部署 ingress-nginx

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm pull ingress-nginx/ingress-nginx --version 4.12.0
tar -zxf /opt/kubernetes/deploy/ingress-nginx-*.tgz -C /opt/kubernetes/deploy/
sed -i "s#registry.k8s.io#<国内源>#g" /opt/kubernetes/deploy/ingress-nginx/values.yaml

kubectl create namespace ingress-nginx
helm install ingress-nginx /opt/kubernetes/deploy/ingress-nginx --namespace ingress-nginx
```

改为 NodePort：

```bash
kubectl edit svc -n ingress-nginx ingress-nginx-controller   # type: NodePort
```

> 污点调度：可给 ingress 节点打 label + 污点，只让 ingress-nginx 调度到指定节点：
>
> ```bash
> kubectl label node <node> nginx=true
> kubectl taint nodes <node> nginx=true:NoSchedule
> kubectl get nodes -o=jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.taints}{"\n"}{end}'
> ```

---

## 八、集群验证

```bash
# 部署 busybox 测试 Pod（注意使用 1.28 版本，新版有 DNS 解析问题）
kubectl apply -f busybox.yaml
kubectl get pod

# 解析默认命名空间的 kubernetes 服务
kubectl exec busybox -n default -- nslookup kubernetes

# 跨命名空间解析
kubectl exec busybox -n default -- nslookup coredns.kube-system

# 每个节点需能访问 kubernetes svc 443 和 kube-dns svc 53
telnet <service网段>.1 443
telnet <service网段>.10 53
```

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航。
