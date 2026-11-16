+++
title = "NFS 技术和维护"
date = 2026-02-28T10:00:00+08:00
draft = false
author = ""
keywords = ["nfs", "nfsv3", "nfsv4", "rdma", "存储", "性能调优"]
summary = "NFS 技术系列文档的总目录，涵盖协议基础、NFSv4 状态管理、性能调优、高可用故障定位与 RDMA。"
tags = ["nfs", "guide"]
+++

# NFS 技术和维护

这里是 NFS 技术系列文档的总目录。整体介绍与各模块入口见 [总览与主文档]({{< ref "/post/nfs-guide" >}})。

各分文档：

- [总览与主文档]({{< ref "/post/nfs-guide" >}}) —— 整体介绍 NFS 与各模块引导。
- [NFSv3 与 NFSv4 的本质区别]({{< ref "nfsv3-vs-nfsv4" >}})
- [一次 NFSv3 READ 的完整调用链]({{< ref "nfsv3-read-call-chain" >}})
- [file handle 与 ESTALE]({{< ref "file-handle-estale" >}})
- [NFSv4 客户端状态机]({{< ref "state-machine" >}})
- [NFSv4.1 session 与 slot 表]({{< ref "session-slot" >}})
- [delegation 的授予与 CB_RECALL 回收]({{< ref "delegation-callback" >}})
- [NFS 性能调优]({{< ref "performance-tuning" >}})
- [NFS 多链路：nconnect / trunking / bonding]({{< ref "multi-link" >}})
- [nfsd 线程模型与 D 状态]({{< ref "nfsd-thread-dstate" >}})
- [NFS 无损切换]({{< ref "lossless-switching" >}})
- [NFS over RDMA 原理]({{< ref "nfs-over-rdma" >}})
- [RDMA 传输层 xprtrdma]({{< ref "rdma-xprtrdma" >}})

> 说明：github-style 主题的 `list.html` 只渲染子页面列表，不渲染本页正文。完整的「主文档」内容请阅读 [总览与主文档]({{< ref "/post/nfs-guide" >}})。
