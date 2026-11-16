+++
title = "ELK 日志系统（ECK + Filebeat + Kafka + Logstash）"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["elk", "elasticsearch", "eck", "filebeat", "kafka", "logstash", "kibana", "kubernetes"]
summary = "在 Kubernetes 上完整部署 ELK 日志系统：ECK 部署 Elasticsearch/Kibana/Logstash、Filebeat 采集、Strimzi KRaft 部署 Kafka，含端到端验证与问题处理。"
tags = ["elk", "elasticsearch", "eck", "filebeat", "kafka", "logstash", "kibana"]
+++

# ELK 日志系统（ECK + Filebeat + Kafka + Logstash）

本文完整介绍在 Kubernetes 上部署 ELK 日志系统，涵盖安装、端到端验证与问题处理。所有 IP、镜像仓库、StorageClass、密码均为占位符。

<!--more-->

---

## 一、概述

### 1.1 部署方案选型

| 方案 | 适用场景 | 特点 |
| --- | --- | --- |
| **ECK Operator（推荐）** | 生产环境 | Elastic 官方 Operator，自动化部署、扩缩容、升级 |
| Helm Chart | 快速搭建/定制化 | 配置灵活 |
| 原生 YAML | 学习/测试 | 完全手动控制 |

### 1.2 架构

```text
Filebeat（采集）→ Kafka（缓冲）→ Logstash（处理）→ Elasticsearch（存储）→ Kibana（可视化）
```

```text
┌─────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                  │
│  ┌──────────┐   ┌─────────┐   ┌───────────┐        │
│  │ Filebeat │──▶│  Kafka  │──▶│ Logstash  │        │
│  │DaemonSet │   │(缓冲队列)│   │(过滤处理) │        │
│  └──────────┘   └─────────┘   └─────┬─────┘        │
│        │                             │              │
│        └───────────────────▶┌───────────────┐       │
│                             │ Elasticsearch │       │
│                             │  (3节点集群)   │       │
│                             └───────┬───────┘       │
│                                     ▼               │
│                             ┌───────────────┐       │
│                             │    Kibana     │       │
│                             └───────────────┘       │
└─────────────────────────────────────────────────────┘
```

### 1.3 资源规划

| 组件 | 建议资源 |
| --- | --- |
| Elasticsearch | 至少 4GB RAM（2GB JVM Heap + 2GB OS Cache），每节点 4 核；生产至少 3 节点 |
| Kibana | 2GB RAM |
| Filebeat | 每个 Pod 100-200MB |
| Logstash | 每个实例 1-2GB，JVM Heap ≤ 总内存 50% |

> ES 数据节点对磁盘 I/O 敏感，务必用高性能 StorageClass（SSD），**不要用 NFS**。

---

## 二、安装 ECK Operator 并部署 Elasticsearch

### 2.1 安装 ECK Operator

```bash
wget https://download.elastic.co/downloads/eck/3.4.0/crds.yaml
wget https://download.elastic.co/downloads/eck/3.4.0/operator.yaml

# 内网离线：同步镜像
ctr -n k8s.io images pull --all-platforms docker.elastic.co/eck/eck-operator:3.4.0
ctr -n k8s.io images tag docker.elastic.co/eck/eck-operator:3.4.0 <harbor>/mirror/docker.elastic.co/eck/eck-operator:3.4.0
ctr -n k8s.io images push --plain-http --user <harbor-user>:<harbor-password> <harbor>/mirror/...

kubectl create -f crds.yaml
kubectl apply -f operator.yaml
kubectl get pods -n elastic-system   # 应有 elastic-operator-0 Running
```

### 2.2 部署 Elasticsearch 集群

```yaml
# crm-elasticsearch.yml
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: quickstart
  namespace: logging
spec:
  version: 9.4.2
  nodeSets:
    - name: default
      count: 3
      config:
        node.store.allow_mmap: false
      volumeClaimTemplates:
        - metadata:
            name: elasticsearch-data
          spec:
            accessModes: ["ReadWriteOnce"]
            storageClassName: "<storage-class>"
            resources:
              requests:
                storage: 50Gi
```

```bash
kubectl create namespace logging
kubectl apply -f crm-elasticsearch.yml
kubectl get elasticsearch -n logging
kubectl get pods -n logging -l elasticsearch.k8s.elastic.co/cluster-name=quickstart
```

> 问题：旧 CPU 上 ES 9.4.0 报 `The current machine does not support ... CPU features`（CX8/CMOV/AVX/AVX2 等指令集缺失），是官方镜像要求过严；已修复于 9.4.2。

### 2.3 外部访问 ES API

```bash
kubectl edit elasticsearch quickstart -n logging
# spec.http.service.spec.type: NodePort 或 LoadBalancer
kubectl get svc -n logging quickstart-es-http
curl -k -u elastic:<密码> https://<节点IP>:<NodePort>
```

---

## 三、部署 Filebeat 采集容器日志

Filebeat 以 DaemonSet 部署，需创建 ServiceAccount + ClusterRole/ClusterRoleBinding + ConfigMap + DaemonSet。

`filebeat.yml` 核心配置：

```yaml
filebeat.inputs:
  - type: filestream
    id: container-logs
    prospector.scanner.symlinks: true
    parsers:
      - container: ~
    paths:
      - /var/log/containers/*.log
    processors:
      - add_kubernetes_metadata:
          host: ${NODE_NAME}
          matchers:
            - logs_path:
                logs_path: "/var/log/pods/"
      - add_fields:
          target: kubernetes
          fields:
            node:
              name: ${NODE_NAME}
output.elasticsearch:
  hosts: ['https://quickstart-es-http.logging.svc:9200']
  username: "elastic"
  password: "${ELASTICSEARCH_PASSWORD}"
  ssl.verification_mode: none
  index: "k8s-logs-%{+yyyy.MM.dd}"
setup.ilm.enabled: false
setup.template.name: "k8s-logs"
setup.template.pattern: "k8s-logs-*"
```

关键点：

- `type: filestream`（container 输入在 9.0 已禁用，必须迁移）。
- 挂载 `/var/log/containers`（软链接，需 `prospector.scanner.symlinks: true`）与 `/var/log/pods`。
- `runAsUser: 0`；密码从 Secret `quickstart-es-elastic-user` 注入。

```bash
kubectl apply -f crm-filebeat.yml
kubectl get ds -n logging filebeat
kubectl logs -n logging -l app=filebeat --tail=50 | grep -Ei "error|connected|publish"
```

> 问题：DaemonSet `CURRENT=0` 多为 ServiceAccount/ConfigMap 缺失，检查 `kubectl describe daemonset filebeat -n logging`。

---

## 四、部署 Kafka（Strimzi Operator，KRaft 模式）

### 4.1 Strimzi 版本选择

| 维度 | Strimzi 0.46.1 | Strimzi 1.2.0 |
| --- | --- | --- |
| 版本体系 | 0.x | 1.x 稳定版 |
| K8s 兼容 | 1.25+ | 1.30+ |
| CRD API | v1beta2 | 仅 v1（不可逆） |
| Kafka 版本 | 4.0.0 | 4.3.1 |

> 0.46.0 起彻底移除 ZooKeeper，必须用 KRaft 模式。

### 4.2 安装 Operator + 部署 KRaft 集群

```bash
kubectl create namespace kafka
kubectl apply -f strimzi-crds.yaml
kubectl apply -f strimzi-operator.yaml
kubectl get pods -n kafka
```

节点池（controllers 3×10Gi/2Gi，brokers 3×20Gi/4Gi）：

```yaml
# kafka-controllers.yaml
apiVersion: kafka.strimzi.io/v1
kind: KafkaNodePool
metadata:
  name: controllers
  namespace: kafka
  labels:
    strimzi.io/cluster: kafka-cluster
spec:
  replicas: 3
  roles: [controller]
  storage:
    type: jbod
    volumes:
      - id: 0
        type: persistent-claim
        size: 10Gi
        class: <storage-class>
        deleteClaim: false
  resources:
    requests: { memory: 2Gi, cpu: "1" }
    limits: { memory: 2Gi, cpu: "1" }
```

```yaml
# kafka-cluster.yaml
apiVersion: kafka.strimzi.io/v1
kind: Kafka
metadata:
  name: kafka-cluster
  namespace: kafka
  annotations:
    strimzi.io/node-pools: enabled
    strimzi.io/kraft: enabled
spec:
  kafka:
    version: 4.3.1
    metadataVersion: 4.3-IV0
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
      - name: tls
        port: 9093
        type: internal
        tls: true
    config:
      auto.create.topics.enable: "false"
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
      log.retention.hours: 168
      log.segment.bytes: 1073741824
  entityOperator:
    topicOperator: {}
    userOperator: {}
```

```bash
kubectl apply -f kafka-controllers.yaml
kubectl apply -f kafka-brokers.yaml
kubectl apply -f kafka-cluster.yaml
kubectl get pods -n kafka -w   # 期望 6 Pod
```

> 问题：`Unsupported Kafka.spec.kafka.version: 4.0.0`（Strimzi 1.2.0 最低 4.2.0），改 version/metadataVersion 为 4.3.1/4.3-IV0。
> 问题：`FailedScheduling ... Insufficient cpu/memory`（6 Pod 需 9 CPU + 18Gi），需扩容。

### 4.3 Kafka Topic

```yaml
apiVersion: kafka.strimzi.io/v1
kind: KafkaTopic
metadata:
  name: k8s-logs
  namespace: kafka
  labels:
    strimzi.io/cluster: kafka-cluster
spec:
  partitions: 6
  replicas: 3
  config:
    retention.ms: 604800000
    segment.bytes: 1073741824
```

### 4.4 资源不足降级方案

单节点双角色（controller+broker 合一，replicas: 1，20Gi）。

### 4.5 外部客户端连接

```yaml
spec:
  kafka:
    listeners:
      - name: external
        port: 9094
        type: nodeport
        tls: false
        configuration:
          bootstrap:
            nodePort: 32000
          brokers:
            - broker: 0
              nodePort: 32001
```

---

## 五、部署 Logstash（ECK CRD）

```yaml
apiVersion: logstash.k8s.elastic.co/v1alpha1
kind: Logstash
metadata:
  name: quickstart
  namespace: logging
spec:
  version: 9.4.2
  count: 2
  elasticsearchRefs:
    - name: quickstart
      clusterName: qs
  volumeClaimTemplates:
    - metadata:
        name: logstash-data
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 1Gi
        storageClassName: <storage-class>
  pipelines:
    - pipeline.id: k8s-logs
      config.string: |
        input {
          kafka {
            bootstrap_servers => "kafka-cluster-kafka-bootstrap.kafka.svc:9092"
            topics => ["k8s-logs"]
            group_id => "logstash-k8s"
            codec => json
            auto_offset_reset => "earliest"
          }
        }
        filter {
          json {
            source => "message"
            target => "app"
            skip_on_invalid_json => true
          }
          ruby {
            code => '
              require "json"
              ["attr", "event", "t", "ips", "error", "stack"].each do |f|
                v = event.get("[app][#{f}]")
                next if v.nil?
                if v.is_a?(Hash) || v.is_a?(Array)
                  event.set("[app][#{f}]", v.to_json)
                else
                  event.set("[app][#{f}]", v.to_s)
                end
              end
            '
          }
          mutate {
            remove_field => ["@version", "agent.ephemeral_id", "agent.id"]
          }
        }
        output {
          elasticsearch {
            hosts => ["${QS_ES_HOSTS}"]
            user => "${QS_ES_USER}"
            password => "${QS_ES_PASSWORD}"
            index => "k8s-logs-%{+YYYY.MM.dd}"
            ssl_enabled => true
            ssl_verification_mode => "none"
          }
        }
```

关键点：

- `elasticsearchRefs.clusterName`（如 `qs`）让 ECK 自动注入 `${QS_ES_HOSTS}` / `${QS_ES_USER}` / `${QS_ES_PASSWORD}` 等环境变量。
- 多副本通过 `group_id` 去重；Filter 优先 json/dissect，避免全量 grok。

### 5.1 修改 Filebeat 输出到 Kafka

```yaml
output.kafka:
  hosts: ["kafka-cluster-kafka-bootstrap.kafka.svc:9092"]
  topic: "k8s-logs"
  partition.round_robin:
    reachable_only: true
  required_acks: 1
  compression: gzip
  max_message_bytes: 1000000
```

---

## 六、部署 Kibana

```yaml
apiVersion: kibana.k8s.elastic.co/v1
kind: Kibana
metadata:
  name: quickstart
  namespace: logging
spec:
  version: 9.4.2
  count: 1
  elasticsearchRef:
    name: quickstart
  http:
    tls:
      selfSignedCertificate:
        disabled: true
```

```bash
kubectl apply -f crm-kibana.yaml
# 外部访问：spec.http.service.spec.type: NodePort 或 LoadBalancer
kubectl get svc -n logging quickstart-kb-http
```

---

## 七、环境参数处理

### 7.1 获取 elastic 用户密码

```bash
ES_PASSWORD=$(kubectl get secret quickstart-es-elastic-user -n logging \
  -o jsonpath='{.data.elastic}' | base64 -d)
echo $ES_PASSWORD
```

### 7.2 可选优化

| 项目 | 说明 |
| --- | --- |
| ILM | 自动管理索引滚动和删除 |
| 索引模板 | 提前定义 mapping |
| Logstash pipeline 拆分 | 不同应用不同 pipeline |
| Kibana Dashboard | 按 Namespace/Pod 聚合 |
| 告警 | 基于 `app.level: error` 配置 Alerting |

---

## 八、端到端数据流验证

### 8.1 Kafka 消息队列

```bash
kubectl exec -n kafka kafka-cluster-brokers-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic k8s-logs --from-beginning --max-messages 5
kubectl logs -n logging -l app=filebeat --tail=20 | grep -i "kafka\|error"
```

### 8.2 Logstash

```bash
kubectl get pods -n logging -l logstash.k8s.elastic.co/name=quickstart
kubectl logs -n logging -l logstash.k8s.elastic.co/name=quickstart --tail=200 | grep -c "status.*400"   # 期望 0
```

### 8.3 LAG

```bash
kubectl exec -n kafka kafka-cluster-brokers-0 -- \
  bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group logstash-k8s | tail -6
```

| 趋势 | 判断 |
| --- | --- |
| LAG 稳定或缩小 | 正常 |
| LAG 持续增大 | 消费跟不上，需扩容/优化 |

### 8.4 Elasticsearch

```bash
kubectl port-forward -n logging svc/quickstart-es-http 9200:9200
curl -k -u elastic:$ES_PASSWORD "https://localhost:9200/_cluster/health?pretty"
curl -k -u elastic:$ES_PASSWORD "https://localhost:9200/_cat/indices?v" | grep k8s-logs
```

### 8.5 Kibana

```bash
kubectl port-forward -n logging svc/quickstart-kb-http 5601:5601
# 建 Data View：k8s-logs-*，Time field @timestamp
# 搜索：app.level: "error"
```

---

## 九、问题处理

### 9.1 host.name 是 Filebeat Pod 名

- **分析**：Filebeat 容器默认 hostname 就是 Pod 名。
- **解决**：`add_fields` 覆盖 host.name 为 `${NODE_NAME}`，或去掉 `add_host_metadata`。

### 9.2 日志没有 Kubernetes 元数据

- **分析**：`pod_uid` indexer 路径匹配失败 + `default_indexers.enabled: false` 无兜底。
- **解决**：去掉 default_indexers/default_matchers 的 false，用默认 container indexer + logs_path matcher。

原始日志示例（可见缺少 `kubernetes.*` 字段）：

```json
{"@timestamp":"2026-09-18T04:15:32.839Z",
 "@metadata":{"beat":"filebeat","type":"_doc","version":"9.4.2"},
 "ecs":{"version":"8.0.0"},"host":{"name":"filebeat-xxx"},
 "agent":{"name":"filebeat-xxx","type":"filebeat","version":"9.4.2"},
 "log":{"file":{"path":"/var/log/containers/kafka-cluster-controllers-4_kafka_kafka-xxx.log"}},
 "stream":"stdout","message":"Starting Kafka with configuration:","input":{"type":"filestream"}}
```

### 9.3 JSON 日志被塞进 message

- **分析**：Filebeat 只采集不解析；原 pipeline `if [message] =~ /^\{/` 只解析 `{` 开头。
- **解决**：放宽条件 `skip_on_invalid_json => true`。

### 9.4 app.* 字段类型冲突

- **分析**：同一字段类型不一致（`app.attr.error` 有的字符串有的对象），导致 mapping 冲突，报错 `object mapping for [app.attr.error] tried to parse field [error] as object, but found a concrete value`。
- **解决**：白名单 Ruby 强制转字符串（见第五节 pipeline）。

原始冲突日志示例：

```json
{"@timestamp":"2026-09-20T04:40:55.584Z",
 "message":"{\"caller\":\"node_controller.go:46\",\"controller\":\"NodeReconciler\",\"level\":\"info\",\"ts\":\"...\"}",
 "host":{"name":"filebeat-xxx"},
 "agent":{"name":"filebeat-xxx","type":"filebeat","version":"9.4.2"}}
```

部分应用 `attr.error` 是字符串 `"NotYetInitialized: ..."`，部分应用是对象 `{"code":13,...}`，导致 `app.attr.error` mapping 冲突。

重新应用 + 重启 + 删除污染索引：

```bash
kubectl apply -f logstash.yaml
kubectl delete pod -n logging -l logstash.k8s.elastic.co/name=quickstart
kubectl exec -n logging quickstart-es-default-0 -- \
  curl -s -k -u elastic:$ES_PASSWORD -X DELETE "https://localhost:9200/k8s-logs-<日期>"
```

### 9.5 LAG 持续增大

```bash
# 方案 A：加副本（6 分区最多 6 副本）
kubectl patch logstash quickstart-ls -n logging --type=merge -p '{"spec":{"count":3}}'
# 方案 B：调并发
spec:
  config:
    pipeline.workers: 4
    pipeline.batch.size: 250
    pipeline.batch.delay: 50
# 方案 C：查报错
kubectl logs -n logging -l logstash.k8s.elastic.co/name=quickstart-ls --tail=100 | grep -Ei "error|warn|retry|failed"
```

### 9.6 ES 大量索引（磁盘将满）

- 手动清理 / ILM（推荐）/ CronJob / alias 模式（Filebeat `setup.ilm.enabled: true`）。

### 9.7 已污染的索引清理

```bash
kubectl exec -n logging quickstart-es-default-0 -- \
  curl -s -k -u elastic:$ES_PASSWORD -X DELETE "https://localhost:9200/k8s-logs-<日期>"
```

---

## 十、生产环境最佳实践

- **存储**：ES 用云块存储 + IOPS；本地 SSD 注意数据绑定。
- **ILM**：ES 默认磁盘 95% 标记只读。
- **高可用**：ES 至少 3 节点。
- **系统参数**：`vm.max_map_count` ≥ 262144。
- **资源限制**：ES JVM Heap 设为容器内存 50%，≤31GB。

### 10.1 关键配置备份

```bash
mkdir -p ~/elk-backup/{filebeat,logstash,es,kibana,kafka}
kubectl get cm filebeat-config -n logging -o yaml > ~/elk-backup/filebeat/config.yaml
kubectl get logstash quickstart -n logging -o yaml > ~/elk-backup/logstash/logstash.yaml
kubectl get elasticsearch quickstart -n logging -o yaml > ~/elk-backup/es/elasticsearch.yaml
kubectl get kibana quickstart -n logging -o yaml > ~/elk-backup/kibana/kibana.yaml
kubectl get kafka kafka-cluster -n kafka -o yaml > ~/elk-backup/kafka/kafka.yaml
kubectl get kafkanodepool -n kafka -o yaml > ~/elk-backup/kafka/nodepools.yaml
```

> 版本兼容：Kafka Broker、Logstash、Filebeat 需保持兼容。Elastic 官方正推动 Elastic Agent 替代 Filebeat。

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航。
