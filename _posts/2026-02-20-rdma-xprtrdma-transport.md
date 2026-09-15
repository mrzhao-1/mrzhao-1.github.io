---
title: "RDMA 传输层 xprtrdma：RPC 怎么绕过 TCP 直上 RDMA"
date: 2026-02-20 10:00:00 +0800
categories:
  - nfs
tags:
  - 源码分析
  - RDMA
  - xprtrdma
---

> 说明：本文整理自个人项目经验，日期按对应工作阶段标注。

NFS 默认走 TCP，但 Linux 还提供一套 RDMA 传输层，叫 xprtrdma，让 RPC 报文不经过 TCP/IP 协议栈，直接在 RDMA 网络上传输。这篇文章讲它和 TCP 传输的本质区别、RPC-over-RDMA 怎么组织数据、以及它好在哪、坑在哪。

## 一、为什么要有 RDMA 传输

TCP 传输层（xprtsock）的问题是：数据要穿过完整的内核网络协议栈，涉及多次拷贝，CPU 开销高，延迟也不可控。对低延迟、高吞吐、CPU 敏感的场景（EDA 仿真、HPC、AI 训练存储），这是瓶颈。

RDMA 让网卡（HCA）直接访问内存，数据从用户/内核缓冲区直接 DMA 到对端，绕过 CPU 和协议栈。NFS 用它做传输，就是 xprtrdma（代码在 `net/sunrpc/xprtrdma/`），走的是 RPC-over-RDMA 协议（RFC 8166）。

## 二、RPC-over-RDMA 怎么传数据

RPC-over-RDMA 把一次 RPC 拆成两类传输：

- **控制信息**（RPC 头部、参数、小数据）：用 RDMA Send/Recv 原语，走消息队列，和 TCP 里"发一段字节"类似，但省了协议栈。
- **文件数据本体**（读写的 payload）：用 RDMA Write/Read 原语做**直接数据放置**（DDP）。

直接数据放置是关键。比如一次 NFS READ：

1. 客户端先把自己的数据缓冲区注册成 RDMA 内存区（memory region），把这块内存的地址和权限告诉服务端。
2. 服务端用 RDMA Write，把文件数据直接写进客户端那块注册好的内存里。
3. 客户端不用再拷贝，数据已经到位了。

反过来，NFS WRITE 时服务端注册好缓冲区，客户端用 RDMA Read 让服务端直接读走。两边都省掉中间的拷贝。

## 三、内存注册和 credit

RDMA 网卡要 DMA，数据缓冲区必须先**注册**（pinned 内存，拿到 memory region）。注册是有成本的（pinning、建立地址映射），所以传输层会做优化：用 FRWR（fast register work request）动态注册，或复用注册好的缓冲。

另一个概念是 **credit（信用）**。RDMA 的 Send/Recv 需要接收方预先 post 好接收缓冲区，否则发送方不敢发。服务端会预先 post 一批接收缓冲，客户端据此知道"服务端还能收多少个"，这就是 credit。credit 耗尽，客户端就得停发等补充，是一种背压机制。

credit 和服务端预 post 的接收缓冲数量直接相关，调小了并发上不去，调大了浪费内存。

## 四、RDMA 传输好在哪

对比 TCP 传输：

1. **延迟更低**。绕过协议栈，少了中断和拷贝，单次往返延迟明显下降。
2. **CPU 占用更低**。数据不走内核协议栈，CPU 不参与搬数据，同样的吞吐 CPU 省一大截。
3. **零拷贝**。直接数据放置，读写的数据不用在协议栈里拷来拷去。

对延迟敏感、大吞吐、CPU 吃紧的存储场景，这三条是实打实的收益。

## 五、坑在哪

RDMA 传输不是无脑上，坑也不少：

1. **硬件和驱动兼容**。RoCE、InfiniBand、iWARP 三种形态，网卡、交换机、固件版本要匹配，出问题往往先怀疑链路。
2. **内存注册成本**。pinning 和注册有开销，小 IO 密集场景下，注册开销可能抵消掉收益，RDMA 更吃大 IO 和流式场景。
3. **credit 背压**。预 post 接收缓冲没配好，credit 经常耗尽，吞吐反而掉。
4. **连接管理**。RDMA 连接（RDMA_CM）的建立和断开比 TCP 重，链路抖动时的恢复路径更复杂。
5. **排障门槛高**。没有 TCP 那么成熟的抓包生态，`rpcinfo -m`、`rpcdebug`、`/proc/sys/sunrpc/` 下的 xprtrdma 相关接口是主要手段。

## 六、小结

xprtrdma 的价值一句话：**用 RDMA 的直接数据放置替代 TCP 的协议栈拷贝**，换来更低的延迟和 CPU 占用。代价是硬件依赖和运维复杂度更高。选不选 RDMA，取决于负载形态：大 IO、流式、延迟敏感的场景收益大；小 IO 密集、链路不稳的场景，要先想清楚注册开销和恢复复杂度值不值。
