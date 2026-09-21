---
title: "在 Kubernetes 上部署 ELK 日志系统：架构选型与踩坑记录"
date: 2026-05-20 10:00:00 +0800
categories:
  - devops
tags:
  - 实战
  - Kubernetes
  - 日志
---

> 说明：本文整理自个人项目经验，日期按对应工作阶段标注。

业务跑进容器以后，日志分散在每个节点的 `/var/log/containers` 下，出了问题靠 `kubectl logs` 一个个 Pod 翻不现实，需要一套集中式日志系统。这篇文章记录我在 Kubernetes 上把这套链路搭起来的思路和踩过的坑，完整命令和配置见文末仓库。

## 一、为什么选这条链路

最简单的做法是 Filebeat 直接写 Elasticsearch，省掉中间件。但生产环境直连 ES 有两个问题：一是 ES 抖动或重启时日志会丢；二是日志量高峰时 Filebeat 写不进去会堆积。

中间加一个 Kafka 做缓冲，问题就解决了。Filebeat 只负责把日志丢进 Kafka，后面的 Logstash 按自己的节奏消费、解析、写 ES。ES 挂了，Kafka 里还有数据，恢复后接着写，天然削峰填谷。

Logstash 的价值在解析：把 Filebeat 采上来的原始 JSON 拆成结构化字段，方便后面按字段查询。

所以完整链路是 Filebeat（采集）→ Kafka（缓冲）→ Logstash（解析）→ ES（存储）→ Kibana（可视化）。日志量小的场景，可以把 Kafka 和 Logstash 都省掉，直接 Filebeat → ES → Kibana。

## 二、组件怎么部署

三个关键选型：

1. **ES / Kibana / Logstash 用 ECK Operator**。Elastic 官方推荐的 Kubernetes 部署方式，CRD 声明式管理，扩缩容和升级都自动化。
2. **Filebeat 用 DaemonSet**，每个节点一个，采集 `/var/log/containers`。注意 9.0 起 `container` 输入类型已禁用，要迁到 `filestream`。
3. **Kafka 用 Strimzi Operator**。注意新版（1.x）已经彻底去掉 ZooKeeper，强制 KRaft 模式，而且 CRD API 从 v1beta2 升级到 v1，老版本的 YAML 不能直接搬。

## 三、踩过的坑

部署过程不算顺，几个坑值得记下来：

1. **ES 起不来，报缺一堆 CPU 指令集**。这是 ES 9.4.0 镜像构建时引入了更严格的 CPU 要求，旧 CPU 不支持，升到 9.4.2 修复。
2. **Filebeat DaemonSet 的 CURRENT 一直是 0**。Pod 根本没被创建。查下来是 ServiceAccount 和 RBAC 只在 YAML 里引用没定义，补上就好。
3. **Strimzi Operator 报 leases 权限错误**。安装包里 Role / RoleBinding 的 namespace 硬编码成了 `myproject`，直接 apply 不会覆盖，要 `sed` 全局替换再重装。
4. **Kafka 版本对不上**。Strimzi 1.2.0 不支持 Kafka 4.0.0，最低 4.2.0，要把 version 改成 4.3.1。
5. **最麻烦的一个：ES 报 `document_parsing_exception`**。`app.attr.error` 字段有的日志是字符串、有的日志是对象，同一字段类型不一致导致 mapping 冲突。用 Logstash 的 ruby filter 对已知冲突字段做白名单转换（Hash / Array 转 JSON 字符串）解决。
6. **索引无限增长**。一天 682MB，没有删除策略磁盘很快写满。配 ILM 自动滚动和删除。

## 四、小结

这套链路搭起来后，日志从散落在各节点变成集中可查，按 `app.level`、命名空间都能筛。核心是先把链路选对（加 Kafka 缓冲），再用官方 Operator 降低部署复杂度，剩下的坑主要落在版本兼容和 mapping 上。

完整部署和排障文档在：[elk-on-kubernetes](https://github.com/mrzhao-1/elk-on-kubernetes)
