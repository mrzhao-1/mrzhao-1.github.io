---
title: "关于 gitlab 数据备份细节"
permalink: /gitlab/backup/
layout: single
toc: true
toc_label: "本文目录"
toc_icon: "fas fa-list"
toc_sticky: true
---

{% raw %}

本文档描述 gitlab 环境数据备份的详细过程。

参考：https://docs.gitlab.com/omnibus/settings/backups/

---

## 一、备份概念

### artifacts (作业产物)

artifacts 是 CI/CD (持续集成/持续部署) 流水线在运行任务（Job）后生成并保存的输出文件和目录 。包括编译生成的二进制文件、JAR/WAR包、测试报告（HTML/XML）、代码质量报告、日志文件等 。

### registry (容器镜像仓库)

registry 指的是 GitLab 内置的容器镜像仓库（Container Registry） 。它用于存储、管理和分发 Docker 容器镜像。比如，微服务应用打包成的镜像，会存储在 GitLab 的 registry 中，方便后续部署 。

### prometheus

gitlab/prometheus 数据目录也有很高的占用，它是 GitLab 内置的监控组件（Prometheus）存放时序数据库的目录。里面主要是 监控指标数据（比如 CPU、内存、请求速率、SQL 耗时等），备份以为着后续将会进行的恢复动作，届时将会出现环境基准的变动，大概率情况下，对应的指标数据已经过时，可以酌情考虑不进行备份。

以上描述的概念将在备份命令中指定为对应的单元，通过SKIP参数可以跳过指定的对象内容的备份。

## 二、准备备份空间

gitlab备份每次的全量备份会有很高的空间占比，需要隔离出专用的备份空间来存储备份，除了k8s chart部署需要强制使用对象存储来备份，其他部署环境可以使用不同类型的后端存储空间，挂载备份卷到/var/opt/gitlab/backups目录。

## 三、Omnibus 部署 gitlab 环境备份

### 1、备份 gitlab 配置

对环境中的 gitlab 配置进行备份，其中比较重要的为 gitlab-secrets.json，如果该文件丢失，会导致数据库中已加密的“外部 Issue Tracker”配置无法解密。

cd /etc ; tar -zcf /var/opt/gitlab/backups/1773050569_2026_03_09_18.1.2_gitlab_config_backup gitlab

### 2、备份 gitlab 数据

docker exec -t gitlab gitlab-backup create SKIP=artifacts,registry,prometheus

说明：此处的 SKIP 中的对象为以上描述的备份概率中的对应单元。

### 3、定时备份

将以上命令作为两个定时任务放到宿主机中执行：
0 1 * * * docker exec -t gitlab -c "cd /etc ; tar -zcf /var/opt/gitlab/backups/\$( date +"\%Y-\%m-\%d_\%H-\%M-\%S" )_gitlab_config_backup gitlab" >> /var/log/config_backup.log 2>&1
0 1 * * * docker exec -t gitlab gitlab-backup create SKIP=artifacts,registry,prometheus  CRON=1 >> /var/log/config_backup.log 2>&1


CRON=1 可以抑制不必要的输出，避免 cron 任务因产生过多日志而发送告警邮件。

裸宿主机中查看定时任务： sudo crontab -e

查看定时任务日志： journalctl -fu cron

## 四、docker 部署的 gitlab 环境备份

对于 docker 部署的 gitlab 环境，进行手动备份时，可以按照 Omnibus 部署的 gitlab 的备份过程在容器环境中执行对应的命令。但是定时任务无法在现有的 gitlab 业务容器中进行，可以配置sidecar 容器或者在宿主机中配置定时任务来完成备份。

### 1、Cron Sidecar 容器

在 docker-compose.yml 中增加一个专门运行 cron 的 sidecar 容器，通过 docker exec 或 HTTP 调用触发主容器的任务。

使用 javanile/crontab 轻量镜像，直接在 command 中定义 cron 表达式：

```yaml
services:
  gitlab:
    image: gitlab/gitlab-ce:latest
    container_name: gitlab
    # ... 其他配置

  cron:
    image: javanile/crontab
    restart: unless-stopped
    depends_on:
      - gitlab
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # 允许容器内执行 docker 命令
    command:
      - "0 2 * * * docker exec gitlab gitlab-backup create CRON=1"
      - "0 3 * * 0 docker exec gitlab find /var/opt/gitlab/backups -name '*.tar' -mtime +7 -delete"

```

#### 2、宿主机 Cron + docker exec

定时任务运行在宿主机，通过 docker exec 进入容器执行命令。容器内不需要安装任何 cron 服务，保持单一职责。

```
0 2 * * * docker exec -t gitlab -c "cd /etc ; tar -zcf /var/opt/gitlab/backups/\$( date +"\%Y-\%m-\%d_\%H-\%M-\%S" )_gitlab_config_backup gitlab" >> /var/log/config_backup.log 2>&1

#每天凌晨 2:00 执行 GitLab 备份
0 2 * * * docker exec gitlab gitlab-backup create CRON=1 >> /var/log/gitlab-backup.log 2>&1

#每周日凌晨 3:00 清理旧备份（保留最近 7 天）
0 3 * * 0 find /var/opt/gitlab/backups -name "*.tar" -mtime +7 -delete >> /var/log/gitlab-cleanup.log 2>&1
```

## 五、k8s 部署的 gitlab 环境备份

对于 docker 部署的 gitlab 环境，进行手动备份时，可以按照 Omnibus 部署的 gitlab 的备份过程在POD的对应容器环境中执行对应的命令。定时任务则可以部署 job 负载来完成。

{% endraw %}