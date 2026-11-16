+++
title = "GitLab 数据恢复"
date = 2025-03-24T10:35:00+08:00
draft = false
author = ""
keywords = ["gitlab", "恢复", "restore", "secrets", "docker", "kubernetes"]
summary = "按部署方式（Omnibus / Docker / Kubernetes）介绍 GitLab 数据恢复流程、Secrets 处理与常见问题。"
tags = ["gitlab", "recover"]
+++

# GitLab 数据恢复

本文介绍各部署方式的 GitLab 数据恢复流程。恢复前务必**完整备份当前环境数据**，并先在测试环境预演，切勿直接在生产环境操作。

<!--more-->

---

## 一、Omnibus / Docker 部署恢复

1. **停止数据变更服务**（保证数据一致性）：

   ```bash
   gitlab-ctl stop sidekiq
   gitlab-ctl stop puma
   ```

2. **（可选）恢复旧配置**：若配置有变化，恢复 `gitlab.rb` 与 `gitlab-secrets.json` 后 `reconfigure`。

3. **执行恢复**（BACKUP 参数只取文件名中的时间戳部分）：

   ```bash
   cd /var/opt/gitlab/backups
   gitlab-backup restore BACKUP=<backup-timestamp>
   ```

   系统提示确认时输入 `yes`。

4. **重启并验证**：

   ```bash
   gitlab-ctl reconfigure
   gitlab-ctl restart
   gitlab-ctl status
   gitlab-rake gitlab:check
   ```

### 1.1 常见错误

| 错误 | 处理 |
| --- | --- |
| `must be owner of extension btree_gist / pg_trgm` | 可忽略；登录数据库确认扩展所属 |
| `dial unix .../gitaly.socket: connection refused` | 检查并启动 Gitaly：`gitlab-ctl status gitaly`、`gitlab-ctl start gitaly` |
| `unable to reset refs ... repository not found` | 正常警告，表示某仓库在备份中不存在（空仓/已删除），脚本会跳过继续 |
| `column ... already exists`（迁移） | 版本差异导致，执行 `gitlab-rake db:migrate` 补齐 |

---

## 二、Kubernetes 部署恢复

K8s chart 的官方恢复工具 `backup-utility` 强依赖对象存储。若旧环境（如 Docker）备份不是对象存储，需要**手动恢复**。

### 2.1 手动恢复流程

| 步骤 | 操作 | 关键点 |
| --- | --- | --- |
| 1. 解压 | 在 Toolbox Pod 中解压 tar 包 | `tar -xvf` |
| 2. 恢复数据库 | 以 postgres 超级用户导入 SQL | 避免权限错误 |
| 3. 恢复仓库 | 复制 `repositories/` 到 Gitaly Pod | 确保 `chown git:git` |
| 4. 恢复 Secrets | 转换 `gitlab-secrets.json` 为 K8s Secret | 必须执行，否则无法解密 |
| 5. 重启验证 | 重启 Pod 并运行 `gitlab:check` | 确认数据完整性 |

**解压备份**：

```bash
TOOLBOX_POD=$(kubectl get pods -n gitlab -l app=toolbox -o jsonpath='{.items[0].metadata.name}')
kubectl cp ./<backup>.tar gitlab/$TOOLBOX_POD:/srv/gitlab/tmp/backups/
kubectl exec -it $TOOLBOX_POD -n gitlab -- bash
cd /srv/gitlab/tmp/backups/ && mkdir -p extracted
tar -xvf <backup>.tar -C extracted
```

**恢复数据库（核心）**：停掉前端写入服务，以超级用户删除并重建数据库后导入：

```bash
kubectl scale deployment <webservice> --replicas=0 -n gitlab
kubectl scale deployment <sidekiq> --replicas=0 -n gitlab

kubectl exec -it <postgresql-pod> -n gitlab -- bash
psql -U postgres -c "DROP DATABASE IF EXISTS gitlabhq_production;"
psql -U postgres -c "CREATE DATABASE gitlabhq_production OWNER gitlab ENCODING = 'UTF8';"
psql -U postgres -d gitlabhq_production -f database.sql
```

> 若恢复过程遇到扩展错误，先以超级用户创建所需扩展：`pg_trgm`、`btree_gist`、`pg_stat_statements`。

**恢复 Git 仓库**：将 `repositories/` 复制到 Gitaly Pod 并调整属主：

```bash
GITALY_POD=$(kubectl get pods -n gitlab -l app=gitaly -o jsonpath='{.items[0].metadata.name}')
kubectl cp gitlab/$TOOLBOX_POD:/srv/gitlab/tmp/backups/extracted/repositories gitlab/$GITALY_POD:/tmp/repositories
kubectl exec -it $GITALY_POD -n gitlab -- bash
mv /tmp/repositories/* /var/opt/gitlab/repositories/
chown -R git:git /var/opt/gitlab/repositories/
```

**恢复 Secrets（至关重要）**：备份不包含 `gitlab-secrets.json`，需手动转换并重建 Secret：

```bash
yq -P '{"production": .gitlab_rails}' gitlab-secrets.json >> gitlab-secrets.yaml
kubectl delete secret <rails-secret-name> -n gitlab
kubectl create secret generic <rails-secret-name> \
  --from-file=secrets.yml=gitlab-secrets.yaml -n gitlab
```

**重启并验证**：扩容服务、删除旧 Pod 触发重建，运行自检：

```bash
kubectl delete pods -l release=my-gitlab -n gitlab
kubectl exec -it $TOOLBOX_POD -n gitlab -- gitlab-rake gitlab:check SANITIZE=true
```

### 2.2 密码登录恢复

恢复后若登录报 `No authentication methods configured`，说明密码登录被禁用。进入 Rails 控制台重新开启：

```ruby
Gitlab::CurrentSettings.update!(password_authentication_enabled_for_web: true)
```

若出现写保护错误，先解锁：`gitlab-rake gitlab:db:unlock_writes`，处理后再 `gitlab-rake gitlab:db:lock_writes`。

---

## 三、Secrets 丢失后的令牌重置

若 `gitlab-secrets.json` 丢失导致加密令牌无法解密，可重置相关令牌：

```ruby
setting = ApplicationSetting.find(1)
setting.reset_runners_registration_token!
setting.save!

user = User.find(1)
user.static_object_token = nil
user.save!(validate: false)
```

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [数据迁移与项目导入]({{< ref "migrate" >}})。
