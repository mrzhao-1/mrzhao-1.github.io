+++
title = "NFS 技术和维护（总览）"
date = 2026-02-28T10:05:00+08:00
draft = false
author = ""
keywords = ["nfs", "nfsv3", "nfsv4", "rdma", "存储", "性能调优", "高可用"]
summary = "NFS 技术系列的主文档：整体介绍 NFS 协议架构，并按协议基础、状态管理、性能调优、高可用与 RDMA 引导到各分文档。"
tags = ["nfs", "overview"]
+++

# NFS 技术系列（总览）

本文档是 NFS 技术系列的**主文档**。第一章整体介绍 NFS 的协议架构；后续各章按「协议基础 → 状态管理 → 性能调优 → 高可用与故障 → RDMA」展开，各分文档是独立的原理/源码分析文章，本文以引用（`ref`）的方式引导。

<!--more-->

---

## 第一章 NFS 概述

### 1.1 NFS 是什么

NFS（Network File System）是一套网络文件系统协议，让客户端像访问本地磁盘一样访问远程服务器上的文件。它基于 RPC（Remote Procedure Call）工作：客户端把文件操作（读、写、打开、加锁）封装成 RPC 请求发到服务端，服务端执行后返回结果。

### 1.2 技术地图

```text
                          ┌────────────────────────────────────────────┐
                          │                  NFS 技术体系               │
                          └───────────────────┬────────────────────────┘
        ┌──────────────┬──────────────┬────────┼─────────┬───────────────┐
        ▼              ▼              ▼        ▼         ▼               ▼
 ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐
 │ 协议基础    │ │ 状态管理    │ │ 性能调优   │ │ 高可用/故障│ │ 多链路    │ │  RDMA    │
 │ NFSv3/v4   │ │ stateid    │ │ rsize/wsize│ │ nfsd 线程 │ │ nconnect │ │ xprtrdma │
 │ 调用链      │ │ session    │ │ 写日志     │ │ D 状态    │ │ trunking │ │ RPC-over │
 │ file handle│ │ delegation │ │ 打桩定位   │ │ 无损切换   │ │ bonding  │ │  -RDMA   │
 └────────────┘ └────────────┘ └───────────┘ └─────────┘ └──────────┘ └─────────┘
```

### 1.3 一条主线

整个 NFS 技术体系的演进有一条主线：**从无状态到有状态**。

- **NFSv3 是无状态协议**：每个 RPC 自带全部信息，服务端不记客户端，简单但每次都要「问清楚」，缓存不敢放心做。
- **NFSv4 是有状态协议**：客户端与服务端维护一整套状态（clientid、stateid、session、slot、delegation），用 lease 管理生命周期，换来了缓存性能与锁的可靠性，也带来了状态对齐与恢复的复杂度。

理解了这条主线，NFS 的调用链、状态机、delegation、session、无损切换、乃至 RDMA 传输，就都有了着落。

---

## 第二章 协议基础

| 主题 | 说明 | 文档 |
| --- | --- | --- |
| NFSv3 与 NFSv4 的本质区别 | 无状态 vs 有状态，衍生出 compound、lease、delegation、锁、回调 | [NFSv3 与 NFSv4 的本质区别]({{< ref "/nfs/nfsv3-vs-nfsv4" >}}) |
| 一次 NFSv3 READ 的完整调用链 | 页缓存 → pageio 聚合 → rpc_task 状态机 → 传输层 → 服务端 nfsd | [一次 NFSv3 READ 的完整调用链]({{< ref "/nfs/nfsv3-read-call-chain" >}}) |
| file handle 与 ESTALE | fsid + inode + generation 如何定位文件，以及为何会 stale | [file handle 与 ESTALE]({{< ref "/nfs/file-handle-estale" >}}) |

---

## 第三章 NFSv4 状态管理

| 主题 | 说明 | 文档 |
| --- | --- | --- |
| NFSv4 客户端状态机 | 从 OPEN 到 stateid、session、slot 的建立顺序与自愈 | [NFSv4 客户端状态机]({{< ref "/nfs/state-machine" >}}) |
| NFSv4.1 session 与 slot 表 | 并发上限的由来与 slot 耗尽症状 | [NFSv4.1 session 与 slot 表]({{< ref "/nfs/session-slot" >}}) |
| delegation 与 CB_RECALL | 授予、使用与回收，callback 断裂的连锁后果 | [delegation 的授予与 CB_RECALL 回收]({{< ref "/nfs/delegation-callback" >}}) |

---

## 第四章 性能调优

| 主题 | 说明 | 文档 |
| --- | --- | --- |
| NFS 性能调优 | IO 块大小、线程/连接数、写日志、写策略与打桩方法论 | [NFS 性能调优]({{< ref "/nfs/performance-tuning" >}}) |
| NFS 多链路 | nconnect、session trunking、bonding 三层叠加 | [NFS 多链路]({{< ref "/nfs/multi-link" >}}) |

---

## 第五章 高可用与故障定位

| 主题 | 说明 | 文档 |
| --- | --- | --- |
| nfsd 线程模型与 D 状态 | 后端一抖为何整个 NAS 卡死，以及定位手段 | [nfsd 线程模型与 D 状态]({{< ref "/nfs/nfsd-thread-dstate" >}}) |
| NFS 无损切换 | grace period 与状态恢复如何做到业务不中断 | [NFS 无损切换]({{< ref "/nfs/lossless-switching" >}}) |

---

## 第六章 RDMA

| 主题 | 说明 | 文档 |
| --- | --- | --- |
| NFS over RDMA 原理 | RDMA 为何降延迟省 CPU，三种形态与适用场景 | [NFS over RDMA 原理]({{< ref "/nfs/nfs-over-rdma" >}}) |
| RDMA 传输层 xprtrdma | RPC 如何绕过 TCP，直接数据放置与 credit | [RDMA 传输层 xprtrdma]({{< ref "/nfs/rdma-xprtrdma" >}}) |

---

## 附录：文档导航

本系列包含以下文档：主文档（本文）位于 `content/post/`，其余分文档位于 `content/nfs/` 目录下：

| 文档 | 路径 | 内容 |
| --- | --- | --- |
| **总览（本文）** | [`post/nfs-guide.md`]({{< ref "/post/nfs-guide" >}}) | 整体介绍 + 各模块引导 |
| 分区首页 | [`nfs/_index.md`]({{< ref "/nfs" >}}) | 系列总目录 |
| NFSv3 与 NFSv4 | [`nfs/nfsv3-vs-nfsv4.md`]({{< ref "/nfs/nfsv3-vs-nfsv4" >}}) | 无状态 vs 有状态 |
| NFSv3 READ 调用链 | [`nfs/nfsv3-read-call-chain.md`]({{< ref "/nfs/nfsv3-read-call-chain" >}}) | 读路径逐层拆解 |
| file handle 与 ESTALE | [`nfs/file-handle-estale.md`]({{< ref "/nfs/file-handle-estale" >}}) | fh 生成与校验 |
| NFSv4 客户端状态机 | [`nfs/state-machine.md`]({{< ref "/nfs/state-machine" >}}) | 状态建立与流转 |
| session 与 slot | [`nfs/session-slot.md`]({{< ref "/nfs/session-slot" >}}) | 并发上限 |
| delegation 与 CB_RECALL | [`nfs/delegation-callback.md`]({{< ref "/nfs/delegation-callback" >}}) | 缓存权授予与回收 |
| NFS 性能调优 | [`nfs/performance-tuning.md`]({{< ref "/nfs/performance-tuning" >}}) | 调优维度 |
| NFS 多链路 | [`nfs/multi-link.md`]({{< ref "/nfs/multi-link" >}}) | nconnect/trunking/bonding |
| nfsd 线程模型与 D 状态 | [`nfs/nfsd-thread-dstate.md`]({{< ref "/nfs/nfsd-thread-dstate" >}}) | 连锁卡死机理 |
| NFS 无损切换 | [`nfs/lossless-switching.md`]({{< ref "/nfs/lossless-switching" >}}) | grace period 与恢复 |
| NFS over RDMA | [`nfs/nfs-over-rdma.md`]({{< ref "/nfs/nfs-over-rdma" >}}) | RDMA 原理 |
| RDMA xprtrdma | [`nfs/rdma-xprtrdma.md`]({{< ref "/nfs/rdma-xprtrdma" >}}) | RDMA 传输层 |

建议按「协议基础 → 状态管理 → 性能调优 → 高可用 → RDMA」的顺序阅读。
