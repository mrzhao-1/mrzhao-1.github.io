---
title: "一次 NFSv3 READ 从客户端到服务端的完整调用链"
date: 2021-05-20 10:00:00 +0800
categories:
  - nfs
tags:
  - 源码分析
  - NFSv3
  - RPC
---

> 说明：本文整理自个人项目经验，日期按对应工作阶段标注。

这篇文章回答一个问题：一次普通的 `read()` 在 NFS 客户端上，会触发一长串动作，最终落到服务端把数据读回来。中间经过哪些层、每一层干什么、哪里最可能卡住。

理解这条链路有两个直接用处。第一，NFS 的性能问题几乎都卡在某一层的某个点上，知道每层干什么才能往下拆。第二，客户端"卡住""进程 D 状态"这类现象，本质是这条链上某个环节在等，顺下去就能定位。

先说结论。整条链路长这样：

```
应用 read()
   │  sys_read → vfs_read
   ▼
nfs_file_read (fs/nfs/file.c)
   │  generic_file_read
   ▼
nfs_readpage / nfs_readpages (fs/nfs/read.c)   ← 页缓存未命中，触发预读
   │  nfs_pageio_add_request
   ▼
nfs_pageio 聚合（多个 page 合并成一次 RPC）
   │  nfs_pageio_complete → nfs_generic_pg_read
   ▼
nfs_initiate_read → rpc_run_task (net/sunrpc/sched.c)
   │  创建 rpc_task，投到 rpciod 工作队列
   ▼
rpciod 执行 RPC 状态机：call_reserve → call_transmit
   │  nfs3_xdr_enc_read3args 做 XDR 编码
   │  xprt_send_request → xprtsock 走 TCP 发出
   ▼
──────────────── 网络 ────────────────
   ▼
服务端 svc_recv → svc_process (net/sunrpc/svc.c)
   │  分发到 NFS 服务程序
   ▼
nfsd3_proc_read (fs/nfsd/nfs3proc.c)
   │  nfsd_read → vfs_read（真正读磁盘）
   ▼
nfs3_xdr_enc_read3res 编码结果 → svc_sendreply 原路返回
```

下面一层一层拆。

## 一、从 read() 到 NFS 读页

应用的 `read(fd, buf, len)` 进入系统调用后，最终调到文件对应的 `f_op->read`。NFS 文件系统的入口是 `nfs_file_read`，它先把请求交给通用层 `generic_file_read`。

通用层先去页缓存里找有没有这块数据。命中了就直接拷贝返回，根本不发 RPC。没命中，才会走到 NFS 自己的 `nfs_readpage`（单页）或 `nfs_readpages`（预读多个页）。

这里有个关键点：**页缓存是 NFS 读路径的第一道缓存，也是性能的第一层开关**。`nfs_readpages` 会做预读（readahead），预读窗口多大直接影响顺序读的吞吐。窗口小了，一次读一点，RPC 次数多，性能差；窗口大了，内存占用上升。这就是为什么调参时 `rsize` 和预读策略要一起看。

## 二、pageio：把散页聚合成大请求

`nfs_readpage` 不会为每一个页单独发一个 RPC，那样开销太大。它把请求交给 `nfs_pageio` 这个聚合器：

1. `nfs_pageio_add_request` 把一个个 page 请求塞进一个 `nfs_pageio_descriptor`。
2. 满足条件（请求连续、总量达到阈值 `rsize` 等）后，`nfs_pageio_complete` 触发一次真正的发送。
3. 读路径对应的完成函数是 `nfs_generic_pg_read`，它再调 `nfs_initiate_read`。

聚合的价值是减少 RPC 次数。顺序读一个大文件，理想情况是几个大 RPC 就搬完，而不是成千上万个小 RPC。这是 NFS 读吞吐能否做上去的核心机制之一。对应到调参，`rsize` 设多少、客户端能不能把相邻页合并，直接决定 RPC 的个数。

## 三、RPC 层：rpc_task 状态机

`nfs_initiate_read` 最终落到 `rpc_run_task`，这是 RPC 层的入口。它创建一个 `rpc_task`，把这个任务投到 **rpciod** 内核工作队列，然后异步返回。

`rpc_task` 的核心是一个状态机，每个状态由一个回调函数实现，典型顺序是：

```
call_start → call_reserve → call_transmit → call_status → call_decode
```

几个关键环节：

- `call_reserve`：向传输层预留一个 slot。传输层有并发上限，预留不到就排队等。
- `call_transmit`：把请求真正发出去。先经过 XDR 编码（NFSv3 读参数在 `nfs3_xdr_enc_read3args` 里编码成网络字节序），再交给传输层。
- `call_decode`：收到回包后解码（`nfs3_xdr_dec_read3res`），把结果写回页。

理解这个状态机，是理解"客户端为什么会卡住"的钥匙。应用进程如果是同步读（比如 `O_SYNC`，或者页缓存回写路径），它会在等待 `rpc_task` 完成时进入 **D 状态（不可中断睡眠）**。所以一堆进程卡 D 状态，往 RPC 层看：是不是 slot 占满在排队、是不是在等超时重传、是不是服务端一直不回包。

## 四、传输层：XDR 编码 + TCP

`call_transmit` 里先编码再发送。

XDR（RFC 4506）负责把主机本地的数据表示（比如 64 位整数、文件句柄、字符串）编码成网络通用的字节序和布局。NFS 协议消息本身就是 XDR 格式，客户端在 `nfs3xdr.c` 里编码请求、解码响应，服务端在 `nfsd/nfs3xdr.c` 里做镜像操作。

编码完成后，`xprt_send_request` 调用传输层。TCP 场景走 `xprtsock`，最终通过 `kernel_sendmsg` 把字节发出去。

传输层还管三件事：

- 连接管理。TCP 连接断了要重连、重建。
- 超时与重传。RPC 有 minor timeout（软超时，触发重传）和 major timeout（硬超时，触发"server not responding"报错）。
- 背压。发送队列满时，请求在传输层排队。

## 五、服务端：svc 分发到 nfsd3_proc_read

服务端是另一套调度框架，叫 svc（sunrpc service）。

服务端内核里有若干 `nfsd` 线程，每个线程循环做 `svc_recv` 收包，然后 `svc_process` 根据程序号（NFS 是 program 100003）分发给对应的处理函数。NFSv3 的读处理函数是 `nfsd3_proc_read`。

`nfsd3_proc_read` 解析出 file handle、offset、count，调 `nfsd_read`，最终落到 `vfs_read` 真正读底层文件系统（对 NAS 来说就是读本地磁盘或 ZFS 等后端）。读出来的数据用 `nfs3_xdr_enc_read3res` 编码，`svc_sendreply` 原路发回。

服务端这层的瓶颈很直接：**nfsd 线程数是并发上限**。线程都被占满时，新请求在 svc 层排队，客户端那边表现为 RPC 变慢、超时。所以"服务端 nfsd 线程数"和"客户端连接数、并发数"是要匹配着调的。

## 六、回包与页标记

响应回到客户端，`call_decode` 解码出数据，写进对应的 page，然后调用读完成回调 `nfs_readpage_result`，把 page 标记为 up-to-date、解锁。此时 `generic_file_read` 才能把数据拷给应用，`read()` 返回。

## 七、这条链上最容易出问题的地方

把上面的链路和实际故障对一下：

1. **客户端进程大量 D 状态**：往 RPC 层看。多数是 slot 占满排队、服务端不回包、或超时重传。抓一下 `/proc/self/stack` 或看是不是卡在 `rpc_wait_for_completion`。
2. **吞吐上不去**：先看 RPC 个数，是不是 `rsize` 太小、预读没生效、pageio 没聚合好。RPC 个数降不下来，吞吐就上不去。
3. **"server not responding"**：这是 RPC major timeout。先排除网络丢包、服务端 nfsd 线程打满、防火墙丢包。
4. **顺序读慢**：查预读窗口和 `rsize`，顺序场景下这两个是决定性的。
5. **服务端慢**：看 nfsd 线程数够不够、后端磁盘 IO 是不是瓶颈、ZIL/ZLOG（ZFS 日志盘）有没有拖慢写。

一句话总结：**读路径 = 页缓存（第一道缓存）+ pageio 聚合（减少 RPC 数）+ rpc_task 状态机（异步调度与等待点）+ 传输层（编码/超时/重传）+ 服务端 nfsd（并发上限）**。哪一层出问题，就往哪一层对应的参数和日志上找。
