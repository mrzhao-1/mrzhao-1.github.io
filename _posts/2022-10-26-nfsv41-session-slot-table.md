---
title: "NFSv4.1 的 session 与 slot 表"
date: 2022-10-26 10:00:00 +0800
categories:
  - nfs
tags:
  - 源码分析
  - NFSv4.1
  - session
---

> 说明：本文整理自个人项目经验，日期按对应工作阶段标注。

NFSv4.1 引入 session，是 V4 系列一个大的机制升级。session 管着两件关键的事：一条双向通道（fore channel + back channel），以及一张控制并发上限的 slot 表。这篇文章讲 session 怎么建立、slot 怎么分配和耗尽、耗尽之后性能为什么抖。

## 一、为什么需要 session

NFSv4.0 有一个反直觉的问题：它用 TCP，但一次连接上只允许一个未完成的请求（等一个回一个），并发上不去。而且 callback（服务端主动联系客户端）要另开一条独立连接，跨防火墙、NAT 经常不通。

NFSv4.1 用 session 同时解决这两个问题：

- **多路复用**：一个 session 上可以同时有多个未完成请求，每个请求占一个 slot，用 SEQUENCE 操作区分顺序。
- **内置 backchannel**：callback 复用 session 的反向通道，不用另开连接，穿透性更好。

## 二、session 怎么建立

建立顺序固定，两步：

1. 客户端发 `EXCHANGE_ID`，向服务端登记自己的身份，拿到 clientid。这一步还会做客户端 ID 的确认，服务端能据此发现客户端是不是重启过（用非易失的 client owner id）。
2. 客户端发 `CREATE_SESSION`，协商出 session 参数，其中最重要的是 `nr_slots`（槽位数）和 fore/back channel 的属性。

之后 session 里的每个请求，都以一个 `SEQUENCE` 操作打头，携带 session id、slot id 和 sequence number。服务端据此做请求的多路复用和顺序控制。

## 三、slot 表：并发上限

slot 表是 session 的核心资源。它的语义是：**一个 session 同时最多只能有 nr_slots 个未完成的请求**。

- 客户端要发一个请求，先从 slot 表里申请一个空闲 slot。
- 拿不到空闲 slot，请求就排队等。
- 请求完成，slot 释放，下一个排队请求顶上。

所以 slot 数直接决定了这个 session 的并发上限。slot 数由客户端和服务端在 `CREATE_SESSION` 时协商，双方都受自己资源约束（比如服务端要限制每个客户端占用的内存）。

## 四、slot 耗尽之后的症状

slot 一旦耗尽，表现很典型：

1. **吞吐封顶**。并发已经到 slot 上限，加再多线程、再多连接也没用，因为卡在 slot 上。
2. **延迟抖动**。请求拿不到 slot 要排队，排队时间叠加成延迟。批量场景下尤其明显：一个慢请求占着 slot 不还，后面一堆请求跟着排队。
3. **客户端线程 D 状态**。同步 IO 的线程在等 slot，进入不可中断睡眠，表现为一堆进程卡 D 状态。

排查时如果发现并发上不去、线程卡 D，先看 slot：`nr_slots` 协商出来是多少、实际占用是不是打满了、是不是有慢请求长期占着不释放。

## 五、slot 和线程数、连接数的关系

这是调优时容易绕晕的地方，三者的关系要分清：

- **slot 数**：单 session 的并发上限，是真正的硬约束。
- **连接数**：一个 session 可以跨一条或多条 TCP 连接（session trunking），连接数影响的是网络带宽和负载均衡，不直接等于并发。
- **客户端线程数**：发起请求的源头。线程数超过 slot 数，多余线程就在等 slot，等于白开。

所以调优的次序是：先看 slot 够不够（并发瓶颈），再看连接够不够（带宽瓶颈），最后才看线程数（别开得比 slot 还多）。

## 六、小结

session + slot 是 NFSv4.1 并发模型的核心：EXCHANGE_ID 定身份，CREATE_SESSION 定并发上限，SEQUENCE 做多路复用，slot 表管并发。性能问题里"并发上不去"这一类，十有八九要回到 slot 上来定位。
