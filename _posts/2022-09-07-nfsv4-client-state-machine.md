---
title: "NFSv4 客户端状态机：从 OPEN 到 state、session、slot"
date: 2022-09-07 10:00:00 +0800
categories:
  - nfs
tags:
  - 源码分析
  - NFSv4
  - 状态管理
---

> 说明：本文整理自个人项目经验，日期按对应工作阶段标注。

NFSv3 是无状态的，每个 RPC 自带全部信息，服务端不记住客户端。NFSv4 变成有状态：客户端打开一个文件，双方要维护一整套状态，包括 open owner、stateid、delegation、session、slot。这篇文章讲清这套状态是怎么在客户端一步步建立和流转的。

理解这套状态机，是理解 NFSv4 几乎所有复杂问题（stateid 失效、delegation 回收、session 重建、锁恢复）的前提。

## 一、NFSv4 为什么要状态

无状态的 NFSv3 有个代价：每次读写都要从 file handle 重新定位，客户端不能放心地在本地缓存数据，因为服务端不知道谁在用什么，没法保证一致性。

NFSv4 引入了状态，用 lease（租约）机制管理：客户端持有状态，必须定期续租；超过租约时间没续，服务端就把状态作废。换来的是两样东西：

1. **delegation**：服务端把某个文件的缓存权委托给客户端，客户端可以在本地放心缓存，性能大幅提升。
2. **锁的可靠性**：NFSv3 的 NLM 锁协议是旁路协议，NFSv4 把锁纳入主协议，锁的授予和回收有了明确语义。

## 二、客户端维护的核心数据结构

客户端把这些状态挂在几个对象上，层次从大到小：

| 对象 | 作用 | 大致位置 |
|---|---|---|
| `nfs_client` | 每个服务端一个，存服务器地址、租约、session 等全局状态 | fs/nfs/nfs4client.c |
| `nfs_server` | 每次 mount 一个，存导出点、挂载选项 | fs/nfs/client.c |
| `nfs4_state_owner` | 每个 open owner 一个，代表"谁"打开的 | fs/nfs/nfs4state.c |
| `nfs4_state` | 每个文件一个，存 stateid、锁、delegation | fs/nfs/nfs4state.c |
| `nfs4_session` | NFSv4.1 每次 session 一个，含 slot 表 | fs/nfs/nfs4session.h |
| `nfs4_slot_table` | session 的请求槽位表，控制并发 | fs/nfs/nfs4session.h |

记住这一层关系，后面所有问题都落在某个对象上。

## 三、一次 OPEN 到底干了什么

客户端第一次打开一个文件，`nfs4_proc_open` 会做一串事，按依赖顺序：

1. **确认有 clientid**。NFSv4.1 先发 `EXCHANGE_ID`，向服务端登记自己，拿到 clientid。
2. **建立 session**。发 `CREATE_SESSION`，协商出 forward channel（客户端→服务端）和 backchannel（服务端→客户端回调），并分配 slot 表。
3. **创建 open owner**。为这次 open 建立 `nfs4_state_owner`，分配一个 seqid 用于给这个 owner 的请求排序。
4. **发 OPEN 操作**。NFSv4 的 OPEN 是复合操作（compound）的一部分，可能同时携带 ACCESS、GETATTR、GETFH 等，一次 RPC 干多件事，这是 V4 比 V3 高效的一个来源。
5. **拿到 stateid**。OPEN 成功后服务端返回一个 stateid，客户端把它记在 `nfs4_state` 上。之后这个文件的 READ/WRITE/LOCK 都要带上这个 stateid。
6. **可能拿到 delegation**。如果服务端判断这个文件没有并发写冲突，会在 OPEN 的回复里附带一个 read delegation 或 write delegation。

## 四、stateid 和 seqid：两个容易混的东西

这是 NFSv4 里最容易搞混的一对概念。

- **stateid**：标识"一份状态"。它由服务端分配，不透明，客户端只负责携带和比对。stateid 变了或失效（比如被服务端回收了），客户端旧 stateid 的操作会得到 `BAD_STATEID` 或 `EXPIRED`。
- **seqid**：客户端为每个 state owner 维护的单调递增序号，用来给同一个 owner 的操作排序，服务端据此发现客户端是不是乱序或漏了操作。

简单记：stateid 回答"是哪份状态"，seqid 回答"这是第几个操作"。stateid 失效是客户端最常见的一类报错，处理方式是回到状态机做恢复（reclaim 或重新 OPEN）。

## 五、客户端的状态管理线程

客户端不是出了错才处理状态，它有一个专门的内核线程 `nfs4_state_manager`，持续做状态维护和恢复：

- 定期续租（RENEW 或 SEQUENCE 顺带续租）。
- 检测到 session 失效、租约过期时，触发状态恢复。
- 服务端重启后，客户端要重新建立 clientid、session，并 reclaim 之前的状态（reopen 文件、reclaim 锁）。

这个线程是客户端状态机的大脑。很多"客户端和服务端状态对不上"的问题，都要看这个线程在干什么。

## 六、回调和 backchannel

有状态就得有反向通道。服务端要回收 delegation 或通知客户端状态变化时，需要主动联系客户端，这就是 callback（`CB_RECALL`、`CB_NOTIFY_LOCK` 等）。

- NFSv4.0：callback 走一条客户端监听、服务端主动连上来的独立连接。
- NFSv4.1：callback 复用 session 的 backchannel。

这条反向通道一旦不通（防火墙、NAT、客户端重启），服务端联系不上客户端，就会引发 delegation 回收失败、状态超时这类连锁问题。这是 delegation 那一篇要展开的重点。

## 七、为什么这套状态机值得花时间

对做存储的人来说，NFSv4 的难点不在"怎么发一个 RPC"，而在"状态在双方之间怎么保持同步"。客户端崩溃、服务端重启、网络抖动，都会打破同步，谁负责检测、谁负责恢复、恢复时数据会不会丢，全在这套状态机的设计里。

面试或排查时，能讲清楚"从 OPEN 到 stateid、session、slot 的建立顺序，以及失效后客户端怎么自愈"，就是和只懂 NFSv3 的人拉开差距的地方。delegation 的授予和回收我会单独拆一篇讲，那是最能体现这套状态机价值的机制。
