---
title: "file handle 与 ESTALE：为什么会出现 stale file handle"
date: 2021-12-16 10:00:00 +0800
categories:
  - nfs
tags:
  - 源码分析
  - NFSv3
  - NFSv4
  - 故障定位
---

> 说明：本文整理自个人项目经验，日期按对应工作阶段标注。

"NFS: Stale file handle" 是 NFS 里最让人头疼的报错之一。它不是一个"网络断了"之类能重试就好的错，而是"客户端手里拿的文件句柄，服务端已经不认识"的语义错误。这篇文章讲清 file handle 是怎么生成的、服务端怎么校验它、什么情况下会失效变成 ESTALE。

## 一、file handle 是什么

NFS 里客户端不通过路径名访问文件，而是通过服务端发给它的一个不透明标识，叫 file handle（fh）。客户端 mount 时拿到根目录的 fh，之后每次 lookup 拿到子项的 fh，读写都带着它。服务端收到 fh，要能唯一、稳定地定位回那个文件。

Linux 服务端（nfsd）生成 fh 的核心思路是：**用文件系统标识（fsid）+ inode 号 + inode 代际号（generation）拼出一个句柄**。相关代码在 `fs/nfsd/nfsfh.c`，核心函数是 `fh_compose`（生成）和 `fh_verify`（校验）。

## 二、为什么 fh 里要放 generation

inode 号是会复用的：一个文件删了，新文件可能复用同一个 inode 号。如果 fh 只存 inode 号，客户端手里那个旧 fh 就会"误中"新文件，指向错误的内容，这是数据安全问题。

Linux 内核给 inode 维护了一个 `i_generation` 计数，inode 每次被复用（新文件占用）时 generation 递增。fh 里同时存了 inode 号和 generation，服务端校验时两个都对得上，才认这个 fh。对不上，就回 ESTALE。

## 三、服务端怎么校验

客户端每次带 fh 来操作，服务端在 `fh_verify` 里做这几步：

1. 从 fh 里解出 fsid，找到对应的导出文件系统。
2. 从 fh 里解出 inode 号和 generation，去文件系统里找 inode。
3. 比对 generation 是否一致，一致才通过。

任何一步对不上，就返回 ESTALE（NFSv3）或对应的状态（NFSv4 里是 `NFS4ERR_STALE` / `NFS4ERR_FHEXPIRED`）。

## 四、什么情况下会变成 ESTALE

结合上面的机制，stale file handle 的常见诱因：

1. **文件被删了，且 inode 被复用**。客户端还握着旧 fh，generation 对不上，直接 stale。这是最常见的场景。
2. **导出点或文件系统被重新挂载、重建**。fsid 变了，客户端手里的 fh 全部失效。比如 NAS 后端把某个 LUN 重新格式化、重新导出，客户端下次访问就是 stale。
3. **目录被移动或重命名**。某些实现里 fh 是路径相关的（尤其是 NFSv2/v3 的部分实现），目录一挪位置，fh 就失效。
4. **内核升级导致 fh 编码或 generation 处理变化**。这类是隐蔽的：升级前后 fh 的生成规则、generation 的来源（比如换后端文件系统、换内核版本）不一致，升级前发的 fh，升级后服务端解不出来了。我实际就处理过"nfs 内核升级后出现 file handle stale"的局点问题，根因是 fh 在升级前后的编码假设不一致。

## 五、客户端看到 ESTALE 之后怎么办

客户端对 ESTALE 的恢复能力有限，因为它不知道服务端那边发生了什么：

- 对路径明确的操作，客户端可以重新 lookup 拿到新 fh。
- 对已经在用、且 inode 已经没了的情况，客户端没有好办法，通常只能报错给应用，应用再处理（比如重新打开文件）。

所以 ESTALE 的根治方向在服务端：搞清楚 fh 为什么失效（文件删了？fsid 变了？升级引入的编码不一致？），而不是在客户端反复重试。

## 六、定位思路

遇到 stale file handle，按这个顺序查：

1. 先确认是单个文件 stale，还是整个导出点全 stale。单文件多半是文件被删或 inode 复用；整个导出点全 stale，多半是 fsid 变了（重新挂载、重建文件系统）。
2. 抓服务端日志，看 fh_verify 失败时解析出的 fsid / inode / generation 跟预期差在哪。
3. 如果发生在升级后，重点比对升级前后 fh 的生成路径和 generation 来源，看是不是编码规则变了。

一句话总结：**file handle 是 inode 定位 + generation 防复用的组合，任何让它"对不上"的变化（删除、重建、升级改规则）都会变成 stale**。它不是网络问题，是身份失效问题。
