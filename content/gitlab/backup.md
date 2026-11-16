+++
title = "GitLab 数据备份"
date = 2025-03-24T10:30:00+08:00
draft = false
author = ""
keywords = ["gitlab", "备份", "backup", "omnibus", "docker", "kubernetes"]
summary = "按部署方式（Omnibus / Docker / Kubernetes）介绍 GitLab 数据备份方案与定时任务。"
tags = ["gitlab", "backup"]
+++

# GitLab 数据备份

本文介绍 GitLab 数据备份的概念与各部署方式（Omnibus / Docker / Kubernetes）的备份方案。备份命令中的 SKIP 参数用于跳过指定对象。

> 参考：<https://docs.gitlab.com/omnibus/settings/backups/>

<!--more-->

---

## 一、备份概念

| 对象 | 说明 | 是否建议跳过 |
| --- | --- | --- |
| **artifacts**（作业产物） | CI/CD Job 生成的二进制、测试报告、日志等，体积常达数十上百 GB | 建议跳过 |
| **registry**（镜像仓库） | 内置容器镜像仓库的 Docker 镜像，体积巨大 | 建议跳过 |
| **prometheus**（监控） | 内置监控时序数据，可重新生成，恢复后基准已变 | 建议跳过 |

通过 `SKIP=artifacts,registry,prometheus` 可跳过这些对象，显著减小备份体积与时间。

---

## 二、准备备份空间

全量备份占用较高，需隔离专用备份空间。除 K8s chart 部署强制使用对象存储外，其他环境可挂载专用卷到 `/var/opt/gitlab/backups` 目录。

---

## 三、Omnibus 部署备份

### 3.1 备份配置

```bash
cd /etc
tar -zcf /var/opt/gitlab/backups/$(date +%Y%m%d_%H%M%S)_gitlab_config_backup gitlab
```

> 其中 `gitlab-secrets.json` 最重要，丢失会导致已加密配置无法解密。

### 3.2 备份数据

```bash
docker exec -t gitlab gitlab-backup create SKIP=artifacts,registry,prometheus
```

### 3.3 定时备份

将命令写入宿主机 `crontab`：

```bash
0 1 * * * docker exec -t gitlab -c "cd /etc ; tar -zcf /var/opt/gitlab/backups/\$( date +"\%Y-\%m-\%d_\%H-\%M-\%S" )_gitlab_config_backup gitlab" >> /var/log/config_backup.log 2>&1
0 1 * * * docker exec -t gitlab gitlab-backup create SKIP=artifacts,registry,prometheus CRON=1 >> /var/log/config_backup.log 2>&1
```

- `CRON=1` 抑制不必要输出，避免 cron 产生过多日志触发告警邮件。
- 查看定时任务：`sudo crontab -e`；查看日志：`journalctl -fu cron`。

---

## 四、Docker 部署备份

Docker 环境可在容器内执行与 Omnibus 相同的备份命令，但定时任务需在宿主机或 sidecar 容器中配置。

### 4.1 Cron Sidecar 容器

在 `docker-compose.yml` 中增加一个 cron sidecar 容器：

```yaml
services:
  cron:
    image: javanile/crontab
    restart: unless-stopped
    depends_on:
      - gitlab
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command:
      - "0 2 * * * docker exec gitlab gitlab-backup create CRON=1"
      - "0 3 * * 0 docker exec gitlab find /var/opt/gitlab/backups -name '*.tar' -mtime +7 -delete"
```

### 4.2 宿主机 Cron + docker exec

```bash
0 2 * * * docker exec gitlab gitlab-backup create CRON=1 >> /var/log/gitlab-backup.log 2>&1
# 每周日凌晨 3:00 清理旧备份（保留最近 7 天）
0 3 * * 0 find /var/opt/gitlab/backups -name "*.tar" -mtime +7 -delete >> /var/log/gitlab-cleanup.log 2>&1
```

---

## 五、Kubernetes 部署备份

K8s chart 部署的备份需依赖对象存储，由 Toolbox 的 `backup-utility` 完成，或通过 CronJob 定时触发。手动备份可在对应 Pod 容器内执行与 Omnibus 类似的命令。

> K8s 环境没有 `gitlab-ctl`，管理命令由 Toolbox 容器的 `gitlab-rake` 与 `backup-utility` 提供。

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [数据恢复]({{< ref "recover" >}})。
