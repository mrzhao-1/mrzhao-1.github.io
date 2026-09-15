---
title: "关于 gitlab-k8s 数据恢复细节"
permalink: /gitlab/recover-to-k8s/
layout: single
toc: true
toc_label: "本文目录"
toc_icon: "fas fa-list"
toc_sticky: true
---

{% raw %}

本文档描述在 k8s 环境安装的 gitlab 的数据恢复的详细过程。此记录文档中的过程由于环境和工具限制，未能顺利使用docker部署的备份恢复k8s的gitlab环境，后续会持续改进过程，此条信息更新为可用，或者被去除，即可按照步骤进行，如果有需要且有对应经验的朋友也可以按照文档中的过程进行测试。

测试前一定要完整备份环境数据，并先在测试环境中预研，切勿直接在生产环境中直接处理。

---

重要提示：

由于测试中是从docker备份的历史数据，后端使用的不是对象存储，而在gitlab的helm chart配置的环境中，在toolbox pod中提供的工具有限，且backup-utility必须要求gitlab的后端仓库存储使用的是对象存储，无法正常进行恢复，感兴趣的朋友如果在工具充足的情况下，可以尝试使用手动恢复流程测试数据恢复过程：

## 一、手动恢复完整流程

### 1.1 关键步骤

| 步骤 | 操作 | 关键点 |
| :--- | :--: | ---: |
| 1. 解压 | 在 Toolbox Pod 中解压 tar 包 | 使用 tar -xvf
| 2. 恢复数据库 | 以 postgres 超级用户身份导入 SQL | 避免权限错误
| 3. 恢复仓库 | 复制 repositories/ 到 Gitaly Pod | 确保 chown git:git
| 4. 恢复 Secrets | 转换 gitlab-secrets.json 为 K8s Secret | 必须执行，否则数据无法解密
| 5. 重启验证 | 重启 Pod 并运行 gitlab:check | 确认数据完整性
核心要点：旧 Docker 环境不存在的情况下，手动从备份 tar 包中提取数据库 SQL 并以超级用户身份导入是恢复数据的关键。这绕过了 backup-utility 的权限限制和对象存储检查，直接操作底层数据。

### 1.2 具体过程

#### 1.2.1 解压备份文件

在 K8s 环境中，先将备份文件复制到 Toolbox Pod，然后解压。

1. 获取 Toolbox Pod 名称
```
TOOLBOX_POD=$(kubectl get pods -n gitlab -l app=toolbox -o jsonpath='{.items[0].metadata.name}')
```
2. 将备份文件复制到 Toolbox Pod
```
kubectl cp ./1781629238_2025_10_17_18.1.2_gitlab_backup.tar gitlab/$TOOLBOX_POD:/srv/gitlab/tmp/backups/
```
3. 进入 Toolbox Pod
```
kubectl exec -it $TOOLBOX_POD -n gitlab -- bash
```
在 Pod 内执行解压：
```
cd /srv/gitlab/tmp/backups/
mkdir -p extracted
tar -xvf 1781629238_2025_10_17_18.1.2_gitlab_backup.tar -C extracted
ls -lh extracted/
```

解压后你会看到类似这样的结构：

```
db/ - PostgreSQL 数据库转储文件
repositories/ - Git 仓库数据
uploads/ - 用户上传的附件
builds/ - CI/CD 构建产物
lfs/ - LFS 对象
artifacts/ - CI/CD 产物
```

#### 1.2.2 恢复数据库（核心步骤）
数据库恢复必须以超级用户身份执行，才能避免权限错误。

1. 找到 PostgreSQL Pod 并获取超级用户权限：
```
# 在 Toolbox Pod 内，找到 PostgreSQL 连接信息
cat /srv/gitlab/etc/gitlab-secrets.json | grep -A5 "postgresql"
```
或者在 K8s 外部查找 PostgreSQL Secret：
```
kubectl get secret -n gitlab | grep postgresql
kubectl get secret my-gitlab-postgresql-password -n gitlab -o jsonpath='{.data.postgresql-password}' | base64 -d
```

2. 将数据库转储文件复制到 PostgreSQL Pod：
```
从 Toolbox Pod 复制到本地
kubectl cp gitlab/$TOOLBOX_POD:/srv/gitlab/tmp/backups/extracted/db/gitlabhq_production.sql ./gitlabhq_production.sql
```

再复制到 PostgreSQL Pod
```
PG_POD=$(kubectl get pods -n gitlab -l app=postgresql -o jsonpath='{.items[0].metadata.name}')
kubectl cp ./gitlabhq_production.sql gitlab/$PG_POD:/tmp/gitlabhq_production.sql
```
注意：
```
如果是压缩文件，则将数据库压缩文件复制到PostgreSQL Pod的后端存储：
ci_database.sql.gz database.sql.gz
并在后端存储中，或者是提前修改权限（容器中没有权限直接修改文件的访问权限）
chmod 777 *.gz

gzip -d ci_database.sql.gz
gzip -d database.sql.gz
```

3.停止前端的gitlab服务
```
kubectl scale deployment my-gitlab-gitlab-shell --replicas=0 -n gitlab
kubectl scale deployment my-gitlab-sidekiq-all-in-1-v2 --replicas=0 -n gitlab
kubectl scale deployment my-gitlab-webservice-default --replicas=0 -n gitlab
kubectl scale deployment my-gitlab-registry --replicas=0 -n gitlab
kubectl scale deployment my-gitlab-gitlab-exporter --replicas=0 -n gitlab
```

4. 以超级用户身份执行恢复：
```
# 进入 PostgreSQL Pod
kubectl exec -it my-gitlab-postgresql-0 -n gitlab -- bash
psql -U postgres -d gitlabhq_production -c "SELECT count(*) FROM projects;"
```
查看现有的连接：
```
psql -U postgres -x -c "
SELECT pid, usename, application_name, client_addr, state, query
FROM pg_stat_activity
WHERE datname = 'gitlabhq_production';
"
```
如果连接不为0,会导致删除数据库失败。终止现有连接：
```
psql -U postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'gitlabhq_production'
  AND pid <> pg_backend_pid();

#先删除并重建数据库（确保干净状态）
psql -U postgres -c "DROP DATABASE IF EXISTS gitlabhq_production;"
#如果命令执行失败，提示：ERROR:  database "gitlabhq_production" is being accessed by other users
#则是存在连接，按照之前的方式查看数据库现有的连接，然后进行清除。

psql -U postgres -c "CREATE DATABASE gitlabhq_production OWNER gitlab ENCODING = 'UTF8';"

# 恢复数据库
psql -U postgres -d gitlabhq_production -f database.sql

# 恢复 CI 数据库
psql -U postgres -c "DROP DATABASE IF EXISTS gitlabhq_production_ci;"
psql -U postgres -c "CREATE DATABASE gitlabhq_production_ci OWNER gitlab ENCODING = 'UTF8';"
psql -U postgres -d gitlabhq_production_ci -f /tmp/ci_database.sql

如果恢复过程中遇到扩展相关的错误，可以先以超级用户身份手动创建所需扩展：
psql -U postgres -d gitlabhq_production -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
psql -U postgres -d gitlabhq_production -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
psql -U postgres -d gitlabhq_production -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

psql -U postgres -d gitlabhq_production_ci -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
psql -U postgres -d gitlabhq_production_ci -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
psql -U postgres -d gitlabhq_production_ci -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

5. 验证数据：
```
psql -U postgres -d gitlabhq_production -c "SELECT count(*) FROM projects;"
psql -U postgres -d gitlabhq_production -c "SELECT count(*) FROM users;"
```
现在应该能看到项目数量了。

#### 1.2.3 恢复 Git 仓库数据

Git 仓库数据存储在 repositories/ 目录中，需要复制到 Gitaly Pod 的对应路径。
```
1. 找到 Gitaly Pod
GITALY_POD=$(kubectl get pods -n gitlab -l app=gitaly -o jsonpath='{.items[0].metadata.name}')

2. 将 repositories 目录复制到 Gitaly Pod
kubectl cp gitlab/$TOOLBOX_POD:/srv/gitlab/tmp/backups/extracted/repositories \
  gitlab/$GITALY_POD:/tmp/repositories

3. 在 Gitaly Pod 内，将数据移动到正确位置
kubectl exec -it $GITALY_POD -n gitlab -- bash
mv /tmp/repositories/* /var/opt/gitlab/repositories/
chown -R git:git /var/opt/gitlab/repositories/
```
4、仓库格式不一致
此处如果备份中的仓库格式和待恢复的环境的仓库格式不一致：



#### 1.2.4 恢复 Secrets（至关重要）

GitLab 备份不包含 gitlab-secrets.json，这是数据库加密密钥、CI/CD 变量密钥等敏感信息的存储位置。如果不恢复，所有用户密码、CI 变量都无法解密。

如果你还有旧的 gitlab-secrets.json 文件：

```
1. 将 JSON 转换为 YAML 格式
yq -P '{"production": .gitlab_rails}' gitlab-secrets.json >> gitlab-secrets.yaml

2. 查找现有的 rails-secret
kubectl get secrets -n gitlab | grep rails-secret

# 3. 删除旧 secret 并创建新的
kubectl delete secret <rails-secret-name> -n gitlab
kubectl create secret generic <rails-secret-name> \
  --from-file=secrets.yml=gitlab-secrets.yaml -n gitlab

# 4. 恢复服务
数据恢复完成后再扩容回去：
kubectl scale deployment my-gitlab-gitlab-shell --replicas=2 -n gitlab
kubectl scale deployment my-gitlab-sidekiq-all-in-1-v2 --replicas=1 -n gitlab
kubectl scale deployment my-gitlab-webservice-default --replicas=2 -n gitlab
kubectl scale deployment my-gitlab-registry --replicas=2 -n gitlab
kubectl scale deployment my-gitlab-gitlab-exporter --replicas=1 -n gitlab

# 5. 重启相关 Pods（之前恢复副本可以跳过本步骤）
kubectl delete pods -lapp=sidekiq,release=my-gitlab -n gitlab
kubectl delete pods -lapp=webservice,release=my-gitlab -n gitlab
kubectl delete pods -lapp=toolbox,release=my-gitlab -n gitlab
```

#### 1.2.5 重启服务并验证
```
#重启所有 GitLab 组件
kubectl delete pods -l release=my-gitlab -n gitlab

#等待所有 Pod 就绪
kubectl get pods -n gitlab -w

#运行完整性检查
kubectl exec -it $TOOLBOX_POD -n gitlab -- gitlab-rake gitlab:check SANITIZE=true

对象存储数据（可选）
Not processing files in object storage 的提示意味着备份中的 uploads、artifacts、lfs 等文件需要手动处理：

#从 Toolbox Pod 中提取这些文件
kubectl cp gitlab/$TOOLBOX_POD:/srv/gitlab/tmp/backups/extracted/uploads ./uploads_backup
kubectl cp gitlab/$TOOLBOX_POD:/srv/gitlab/tmp/backups/extracted/artifacts ./artifacts_backup
kubectl cp gitlab/$TOOLBOX_POD:/srv/gitlab/tmp/backups/extracted/lfs ./lfs_backup
```
然后使用 MinIO Client (mc) 将这些文件上传到新环境的对象存储中，上传时需参考 Helm Chart 的 values.yaml 中配置的 bucket 名称。


#### 一、 重要前提 （此处的编号是手动恢复结束，工具恢复过程开始，后续将融合步骤）

版本必须一致：新旧两个 GitLab 实例的版本必须相同。恢复到一个不同的版本可能会导致失败。

已经在gitlab的helm chart中配置了minio相关的配置。

必须使用对象存储：在 GitLab Helm Chart 的官方设计中，备份与恢复功能强依赖对象存储，无法直接使用 NFS 替代。要跨实例恢复，旧实例的数据（如制品、上传的图片等）必须已经存储在对象存储（如 AWS S3、MinIO）中。如果旧数据是本地存储的，需要先迁移到对象存储。

在 Kubernetes 环境中通过 Helm Chart 恢复 GitLab，必须使用对象存储，这也是为什么需要配置两个存储桶。这并非可选项，而是恢复流程的设计要求。

技术原因：Kubernetes 环境中的 Toolbox 恢复工具 backup-utility，其设计就是与对象存储（如 AWS S3、GCS 或 MinIO）交互。恢复时，它会先从存储桶下载备份文件，解压到 Toolbox Pod 的本地磁盘，再恢复到数据库和 Git 仓库等组件。

如果不使用对象存储，使用其他方案，需要修改 backup-utility 脚本：通过修改 Toolbox 容器内的 backup-utility 脚本，将上传逻辑从 s3cmd put 替换为 cp 命令，直接拷贝到 NFS 挂载点。


## 二、环境准备

Kubernetes + Helm Chart 搭建完成的空白的gitlab-k8s环境，环境中没有可用的价值数据。

待迁移环境中的完整的最新备份文件： 1781629238_20265_10_17_18.1.2_gitlab_backup.tar

### 1.1 检查环境

#### 1.1.1 浏览器访问 GitLab 地址

查项目、用户、议题、合并请求、评论、仓库是否正常；

尝试克隆一个仓库；

触发一条 CI Pipeline；

如果 UI 正常，说明环境或者是恢复基本成功。

#### 1.1.2 检查 Pod 状态

检查 Pod 全部 Running，如果有 Pod 异常，需要先解决异常问题： 

```
$# kubectl get pods -n gitlab
NAME                                                 READY   STATUS      RESTARTS           AGE
my-gitlab-gitaly-0                                   1/1     Running     1 (2d10h ago)      5d21h
my-gitlab-gitlab-exporter-5c898d968-qvqh2            1/1     Running     0                  5d22h
my-gitlab-gitlab-pages-56bdc7998d-79z4w              1/1     Running     1 (2d10h ago)      5d9h
my-gitlab-gitlab-runner-54b68b8fdf-d64tp             0/1     Running     1461 (5m18s ago)   5d9h
my-gitlab-gitlab-shell-b679b858f-64tbd               1/1     Running     0                  6d
my-gitlab-gitlab-shell-b679b858f-79425               1/1     Running     0                  5d22h
my-gitlab-kas-7bb8d46b5b-c7cl8                       1/1     Running     1 (2d10h ago)      5d9h
my-gitlab-kas-7bb8d46b5b-r8bgf                       1/1     Running     1 (2d21h ago)      5d9h
my-gitlab-migrations-85150f5-9vl4b                   0/1     Completed   0                  5d1h
my-gitlab-minio-755b55c6c9-d2s2d                     1/1     Running     1 (31h ago)        6d
my-gitlab-nginx-ingress-controller-9ccbc6578-mwhtf   1/1     Running     4 (31h ago)        6d
my-gitlab-nginx-ingress-controller-9ccbc6578-xjtt2   1/1     Running     1 (2d21h ago)      5d22h
my-gitlab-postgresql-0                               2/2     Running     3 (2d10h ago)      5d21h
my-gitlab-prometheus-server-76c54bff4-rzjdp          2/2     Running     18 (25h ago)       5d22h
my-gitlab-redis-master-0                             2/2     Running     8 (31h ago)        5d21h
my-gitlab-registry-bc95c44-2vc76                     1/1     Running     7 (25h ago)        5d9h
my-gitlab-registry-bc95c44-p8ws2                     1/1     Running     1 (2d10h ago)      5d9h
my-gitlab-shared-secrets-cfe3e08-jl875               0/1     Completed   0                  5d3h
my-gitlab-sidekiq-all-in-1-v2-86bdd78448-twfbl       1/1     Running     0                  2d10h
my-gitlab-toolbox-59b949d8f7-g6r7h                   1/1     Running     0                  4d2h
my-gitlab-webservice-default-596d8c6c55-fhsxb        2/2     Running     0                  2d10h
my-gitlab-webservice-default-596d8c6c55-pc9mq        2/2     Running     109 (2d10h ago)    2d20h
```

#### 1.1.3 gitlab 环境自检
待恢复的空白gitlab环境自检，如果有健康问题，需要先解决健康问题： 

```
$# kubectl exec -it -n gitlab deploy/my-gitlab-toolbox -c toolbox -- gitlab-rake gitlab:check SANITIZE=true

```

#### 1.1.4 检查 gitlab 数据库状态

恢复后，特别是 schema 恢复有错误时，建议跑一次数据库迁移：
kubectl exec -it -n gitlab deploy/my-gitlab-toolbox -- gitlab-rake db:migrate
这可以帮助补齐缺失的表、索引或约束。执行前最好确认已备份，但恢复场景下通常可以直接跑。

-- 检查是否有缺失的索引

SELECT * FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'web_hook_logs_daily';

-- 检查分区表

SELECT * FROM pg_partitions WHERE tablename = 'web_hook_logs_daily';

如果发现分区表异常，可能需要手动重建。

如果环境状态问题，可以尝试使用以下方案检查环境：

```
kubectl get deploy -n gitlab
kubectl logs -n gitlab deploy/my-gitlab-webservice-default -c webservice --tail=100
kubectl logs -n gitlab deploy/my-gitlab-sidekiq-all-in-1-v2 -c sidekiq --tail=100
```

#### 1.1.5 gitlab 环境正常的条件

如果 gitlab:check 没有严重报错，UI 也正常，那么可以继续使用。如果发现功能异常，再针对缺失的索引或约束进行修复

### 1.2 工具

gitlab-ctl 在 Helm 部署中不存在，这是正常的。

gitlab-rake 是 toolbox 容器中提供的 gitlab 命令行工具。

backup-utility 是 toolbox 容器中提供的 gitlab 数据恢复工具。

## 三、恢复 gitlab 密钥（Secrets）

必须恢复密钥，尤其是 rails secrets。

密钥的作用：rails secrets 用于加密 session、CI/CD 变量等重要信息。

备份文件主要包含的是数据库和 Git 仓库等数据，而 密钥（Secrets）是独立于备份文件之外管理的。

恢复的必要性：如果不恢复旧实例的密钥，即使数据恢复了，新 GitLab 也无法正确解密这些敏感信息，会导致功能异常。

从 Docker 环境（通常基于 Omnibus 包）恢复时，密钥文件（/etc/gitlab/gitlab-secrets.json）是 JSON 格式，而 Helm Chart 需要 YAML 格式的 Kubernetes Secret。找到这个文件，并使用 yq 工具将其转换为 YAML 格式，然后创建成 Kubernetes Secret。

## 四、备份文件恢复

### 2.1 停掉写入服务

避免恢复过程中有数据写入：
```
kubectl scale deployment my-gitlab-gitlab-shell --replicas=0 -n gitlab
kubectl scale deployment my-gitlab-sidekiq-all-in-1-v2 --replicas=0 -n gitlab
kubectl scale deployment my-gitlab-webservice-default --replicas=0 -n gitlab
kubectl scale deployment my-gitlab-registry --replicas=0 -n gitlab
kubectl scale deployment my-gitlab-gitlab-exporter --replicas=0 -n gitlab
```

### 2.2 获取备份文集


### 2.3 执行恢复

#### 2.3.1 环境说明

gitlab-ctl 是 Omnibus 安装方式（传统 Linux 包安装）的管理命令。

你用的是 GitLab Helm Chart / Kubernetes 部署，各个组件是独立的 Pod，比如 webservice、sidekiq、gitaly、toolbox 等。

Toolbox Pod 里没有 gitlab-ctl和gitlab-backup，它主要提供 gitlab-rake、 backup-utility等命令，用于执行备份、恢复、Rails 任务。

### 2.4 恢复服务

数据恢复完成后再扩容回去：
```
kubectl scale deployment my-gitlab-gitlab-shell --replicas=2 -n gitlab
kubectl scale deployment my-gitlab-sidekiq-all-in-1-v2 --replicas=1 -n gitlab
kubectl scale deployment my-gitlab-webservice-default --replicas=2 -n gitlab
kubectl scale deployment my-gitlab-registry --replicas=2 -n gitlab
kubectl scale deployment my-gitlab-gitlab-exporter --replicas=1 -n gitlab
```

## 五、gitlab 密钥（Secrets）丢失后恢复

### 4.1.1 重置 ApplicationSetting 和 User 的令牌

GitLab 提供了专门的 Rake 任务来全局解锁写入，在主机层面执行即可，无需进入 Rails 控制台。

1. 解锁写入权限

kubectl exec -it -n gitlab deployment/my-gitlab-toolbox -- /bin/bash -c \
  "gitlab-rake gitlab:db:unlock_writes"
这个命令会解锁所有表的写入保护，使后续的 reset_* 操作能够成功执行。

2. 重置 ApplicationSetting 和 User 的令牌

解锁后，在 Rails 控制台中重新执行重置命令：
```
kubectl exec -it -n gitlab deployment/my-gitlab-toolbox -- /bin/bash -c "gitlab-rails console"
```
在控制台中依次执行：

```
# 重置 ApplicationSetting 的 runners_registration_token
setting = ApplicationSetting.find(1)
setting.reset_runners_registration_token!
setting.save!

# 重置 User 的 static_object_token（将 1 替换为实际用户 ID）
user = User.find(1)
user.static_object_token = nil
user.save!(validate: false)

puts "Done"
```

3. 重新锁定写入权限

重置完成后，务必重新启用保护：

kubectl exec -it -n gitlab deployment/my-gitlab-toolbox -- /bin/bash -c \
  "gitlab-rake gitlab:db:lock_writes"

🛠️ 备选方案：删除并重建 ApplicationSetting 记录
如果上述方法仍然失败，可以彻底删除 application_settings 记录，让 GitLab 在下次启动时用当前密钥重建一条全新的记录。
kubectl exec -it -n gitlab my-gitlab-postgresql-0 -- psql -U postgres -d gitlabhq_production
sql
-- 删除记录
DELETE FROM application_settings WHERE id = 1;
\q

然后重启 GitLab 服务，新记录会自动创建：

bash
kubectl rollout restart deployment/my-gitlab-webservice-default -n gitlab
kubectl rollout restart deployment/my-gitlab-sidekiq-all-in-1-v2 -n gitlab
✅ 验证修复
重新运行检查：

bash
kubectl exec -it -n gitlab deployment/my-gitlab-toolbox -- /bin/bash -c \
  "gitlab-rake gitlab:doctor:secrets"
预期输出：
- ApplicationSetting failures: 0
- User failures: 0
Total: 0 row(s) affected

- 重要提醒

static_object_token 在 GitLab 中已被标记为弃用，未来版本会移除该字段。重置该令牌不会影响用户的核心功能，用户无需重新登录或重新授权。

建议优先使用 gitlab:db:unlock_writes + Rails 控制台重置的方案，因为它的影响范围最小。只有在重置仍然失败时，才考虑删除并重建 application_settings 记录（后者会导致所有自定义配置丢失）。

## 六、恢复后操作

### 4.1 重新启用 pg_stat_statements（可选）
如果需要性能监控，可以用超级用户手动创建：

CREATE EXTENSION pg_stat_statements;
并确保 postgresql.conf 中 shared_preload_libraries 包含 pg_stat_statements。

### 4.2 重新开启密码登录
如果在登陆 gitlab web UI 时报错：
GitLab Community Edition
No authentication methods configured.

意味着数据库中的密码登录功能被禁用了，而系统又没有配置其他的登录方式（比如LDAP或SAML）。这很可能是恢复备份后，application_settings 表中的相关配置没有正确加载导致的。

需要通过 GitLab 的 Rails 控制台，直接修改数据库中的设置来重新开启密码登录：

### 4.1.1 登陆 Rails 控制台

```
kubectl exec -it -n gitlab deployment/my-gitlab-toolbox -- /bin/bash -c "gitlab-rails console"
```

### 4.1.2 登陆 Rails 控制台

确认 application_settings 表里到底有没有记录
#如果输出大于 0：说明记录存在，直接跳到第二步。
#如果输出为 0：说明记录不存在，需要先创建它。
##这会使用数据库默认值创建一条全新的配置记录
##ApplicationSetting.create!
##puts "ApplicationSetting record created."
irb(main):008> puts ApplicationSetting.count
1
=> nil

### 4.1.3 启用密码登录
记录存在后，使用更可靠的方法来启用设置。推荐使用 Gitlab::CurrentSettings，它会自动处理缓存和记录的加载。
```
irb(main):009> Gitlab::CurrentSettings.update!(password_authentication_enabled_for_web: true)
=> true
irb(main):010>
irb(main):011> puts ApplicationSetting.current.password_authentication_enabled_for_web
true
=> nil
irb(main):011> setting.save!
irb(main):011> puts "Password authentication enabled via direct model update."
```

### 4.1.4 如果上述方法报错（备用方案）

如果 Gitlab::CurrentSettings.update! 也报错，可以尝试直接操作模型：


### 4.1.5 补充检查：OmniAuth 配置
如果上述操作后问题依旧，请检查你的 /etc/gitlab/gitlab.rb 配置文件。恢复备份时，gitlab.rb 和 gitlab-secrets.json 文件不会自动恢复，需要你手动放置。

请确认 gitlab.rb 中的 omniauth_enabled 设置。如果它被设为 false，且你没有启用其他认证方式，也可能导致此错误。你可以根据实际情况，决定是启用密码登录，还是重新配置 SAML/LDAP 等外部认证。

### 4.1.6 处理旧版设置（如果适用）
如果你的 GitLab 版本较旧（10.5 之前），可能需要同时设置 signin_enabled 字段。可以一并执行以防万一：
setting = ApplicationSetting.first_or_create
setting.signin_enabled = true if setting.respond_to?(:signin_enabled=)
setting.password_authentication_enabled_for_web = true
setting.save!


### 4.1.7 备选方案：直接修改数据库

如果 Rails 控制台始终无法操作，可以退一步，直接通过 PostgreSQL 命令行修改。请注意，这种方法会绕过 Rails 的验证，仅在控制台方法完全失效时使用。

#进入数据库
gitlab-psql gitlabhq_production

#执行更新（如果记录不存在，需要先 INSERT）
UPDATE application_settings 
SET password_authentication_enabled_for_web = true, 
    signin_enabled = true 
WHERE id = 1;

#如果上面返回 0 rows affected，说明记录不存在，需要插入
INSERT INTO application_settings (password_authentication_enabled_for_web, signin_enabled) 
VALUES (true, true);

\q
直接通过 UPDATE 语句修改 password_authentication_enabled 字段的方式在中文技术社区中也有记录。




如果 Gitlab::CurrentSettings.update! 仍然报错
如果执行时出现 PG::SREModifyingSqlDataNotPermitted（写保护错误），说明写入保护还在生效。可以先用 Rake 任务全局解锁：

#在 toolbox 的 shell 中执行（不是 IRB 里）
gitlab-rake gitlab:db:unlock_writes
然后重新进入 gitlab-rails console 执行上面的修复命令，最后再重新锁定：

gitlab-rake gitlab:db:lock_writes
✅ 验证
重启后访问 GitLab 登录页，如果看到用户名和密码输入框，说明问题已解决。


### 4.1.8 验证与后续步骤

 toolbox 容器里用 gitlab-ctl restart（Kubernetes 环境通常没有这个命令，而且你的服务是通过 Deployment 管理的）。应该用 kubectl rollout restart：

kubectl rollout restart deployment/my-gitlab-webservice-default -n gitlab
kubectl rollout restart deployment/my-gitlab-sidekiq-all-in-1-v2 -n gitlab

等待 Pod 就绪后，刷新登录页面，应该就能看到用户名和密码的输入框了。


## 七、其他相关命令

### 5.1.1 查找并终止空闲连接：

如果发现数据库有大量的连接阻塞，可以考虑按照以下方式进行连接释放：

-- 查看当前连接数和状态
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

-- 终止空闲超过15分钟的连接
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < now() - '15 min'::interval
  AND pid <> pg_backend_pid();

验证连接数：
执行后，重新检查连接数，确认有槽位释放：
SELECT count(*) AS current_connections FROM pg_stat_activity;

## 八、总结

恢复任务已完成，文件数据全部恢复。

数据库 schema 恢复有错误，主要是权限和对象依赖导致，可能造成部分索引、约束、分区缺失。

这些错误通常不致命，GitLab 可以继续运行，但建议进行完整性检查。

如果发现功能异常，如查询慢、数据不一致，应针对缺失的索引/约束进行修复。

最稳妥的做法：记录错误日志，运行 gitlab-rake gitlab:check，必要时联系 GitLab 官方支持。

简而言之：恢复成功，但有瑕疵。数据在，索引/约束可能不全。建议验证后使用，有问题再修复。

## 九、常见问题

恢复时出现大量 PostgreSQL schema 错误，比如：

must be owner of extension pg_trgm

cannot drop index ... because ... requires it

relation "web_hook_logs_daily" already exists

partition ... would overlap partition ...

这些错误不一定会导致恢复失败，但可能造成：

部分索引缺失

部分约束缺失

分区表结构异常

pg_stat_statements 扩展未创建


{% endraw %}