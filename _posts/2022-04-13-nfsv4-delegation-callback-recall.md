---
title: "NFSv4 delegation 的授予与 CB_RECALL 回收"
date: 2022-04-13 10:00:00 +0800
categories:
  - nfs
tags:
  - 源码分析
  - NFSv4
  - delegation
  - callback
---

> 说明：本文整理自个人项目经验，日期按对应工作阶段标注。

delegation 是 NFSv4 性能的关键机制，也是最容易出诡异问题的地方。这篇文章讲清三件事：服务端什么时候授 delegation、客户端拿到之后怎么用、服务端要收回时（CB_RECALL）这条链路断了会发生什么。

## 一、delegation 解决什么问题

NFSv3 客户端不敢放心缓存：它不知道自己缓存的文件有没有被别的客户端改过。于是每次操作前都要向服务端确认属性，或者干脆绕过缓存，代价是网络往返多、性能差。

delegation 的本质是**服务端把"这个文件现在只有你在用"的保证，临时授权给客户端**。客户端拿到 delegation 后，可以放心在本地缓存，不用每次问服务端：

- **read delegation**：客户端可以放心缓存文件数据，因为服务端保证这段时间没有别的客户端在写。
- **write delegation**：客户端可以放心在本地缓冲写操作，因为服务端保证没有别的客户端在读写这个文件。write delegation 是性能收益最大的，客户端可以把多次写攒起来再刷下去。

## 二、服务端什么时候授

服务端在客户端发 OPEN 时决定授不授 delegation，核心判断是**有没有冲突的并发访问**：

- 没有别的客户端打开这个文件，可以授。
- 有别的客户端打开，但都是只读，可以授 read delegation。
- 一旦有别的客户端要以写方式打开，就不能授（或要收回已授的）。

服务端还要考虑自己的策略：有些实现为了稳妥，默认不授 delegation；有些实现用 per-file 的冲突检测来决定。这解释了为什么同一个文件，有的客户端能拿到 delegation、有的拿不到。

## 三、客户端拿到之后怎么用

客户端把 delegation 记在 inode 上（`NFS_DELEGATION_READ` / `NFS_DELEGATION_WRITE` 标志），之后的行为随之改变：

- 有 read delegation：读操作直接命中本地页缓存，不发 RPC。
- 有 write delegation：写操作先进本地页缓存缓冲，攒够再刷回服务端。

所以判断一个 NFS 客户端性能好不好，一个重要指标就是 delegation 的命中情况。delegation 频繁被收回，客户端就得频繁退回到"每次操作都问服务端"的低效模式，性能会明显掉。

## 四、服务端要收回：CB_RECALL

当出现新的冲突（比如另一个客户端要写这个文件），服务端必须收回已授出的 delegation，否则缓存一致性就破了。

收回流程走 callback（反向通道）：

1. 服务端通过 backchannel 向客户端发 `CB_RECALL`。
2. 客户端收到后，如果手里有 write delegation，先把缓冲的写刷回服务端。
3. 客户端发 `DELEGRETURN`，把 delegation 还回去。
4. 服务端确认后，delegation 才算真正回收，才能授予新的客户端。

客户端侧的回调处理在 `fs/nfs/callback.c` 和 `fs/nfs/delegation.c` 里，服务端侧的发召回在 `fs/nfsd/nfs4state.c` 里。

## 五、CB_RECALL 断了会发生什么

这是 delegation 最经典的坑：**callback 通道不通，服务端联系不上客户端。**

场景很多：客户端躲在 NAT 或防火墙后面，服务端连不进来；客户端重启了没及时通知；网络分区把反向通道切断了。

服务端不会无限等下去。它有召回超时（recall timeout），通常和租约时间一个量级。超时之后，服务端直接**强制撤销**（revoke）这份 delegation，把对应的 stateid 作废。

后果落在客户端：它还以为自己有 delegation，继续用旧 stateid 发操作，服务端回 `BAD_STATEID` 或 `EXPIRED`。客户端这时才意识到状态丢了，触发状态恢复：刷新、重新 OPEN、reclaim 锁。

几个实际表现：

- 客户端日志里出现 `state manager` 触发的恢复动作，或 `BAD_STATEID` 报错。
- 应用侧可能看到短暂的 IO 停顿，因为恢复期间请求在等。
- 如果客户端没有正确恢复（比如旧 stateid 一直没清干净），会出现持续的 `EXPIRED`，表现为文件访问异常。

## 六、delegation 和租约的关系

delegation 是状态的一种，同样受 lease 管理。客户端续租失败，服务端把租约作废，delegation 也一起没了。所以 delegation 问题的根，经常追到租约：是续租没成功，还是 callback 不通，还是服务端主动 revoke。三者症状接近，定位时先分清是哪一个。

## 七、小结

delegation 是一把双刃剑：

- 拿到并持有，NFSv4 的缓存性能才能发挥出来，这是 V4 相对 V3 提速的重要来源。
- 授出又要收回，而收回依赖一条不一定可靠的 callback 通道，通道一断就是连锁故障。

排查 delegation 相关问题时，先问三个问题：服务端有没有授、客户端有没有真用到、收回时 callback 通不通。三个答案对上了，问题基本就清楚了。
