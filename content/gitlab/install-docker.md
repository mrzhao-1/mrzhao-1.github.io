+++
title = "GitLab 安装 · Docker 部署"
date = 2025-03-24T10:15:00+08:00
draft = false
author = ""
keywords = ["gitlab", "docker", "安装", "docker-compose", "持久化"]
summary = "在 Docker 容器环境中部署 GitLab CE 的过程，含数据持久化、端口映射与外部数据库配置。"
tags = ["gitlab", "docker", "install"]
+++

# GitLab 安装 · Docker 部署

在 Docker 容器中部署 GitLab CE，关键是**数据持久化**与**端口映射**，确保前后端网络连通。本系列文档用 **gitlab-docker** 简称此部署方式。

> 所有示例域名、密码、IP、路径均为占位符，请替换为你的实际环境。

<!--more-->

---

## 一、环境准备

1. **主机名**：为宿主机设置可识别的主机名（容器环境可跳过）。

2. **DNS 与网关**：配置内网 DNS 与默认网关，确保能解析目标域名。

3. **数据盘挂载**：为 GitLab 的数据目录准备独立磁盘，写入 `/etc/fstab` 并挂载：

   ```bash
   systemctl daemon-reload
   mount -a
   ```

4. **共享存储**：如需跨主机共享数据，搭建 NFS 共享空间，并创建 GitLab 所需目录：

   ```bash
   sudo mkdir -p /data/gitlab/{config,logs,data,ssl}
   sudo chmod 755 /data/gitlab/{config,logs,data,ssl}
   ```

5. **导入离线镜像**（内网无法直接拉取时）：先在有外网的机器 `docker save` 导出，再在目标机 `docker import`：

   ```bash
   # 导出（有外网的机器）
   docker save -o gitlab-ce_18.1.2-ce.0.tar gitlab/gitlab-ce:18.1.2-ce.0
   # 导入（内网目标机）
   docker import /path/to/gitlab-ce_18.1.2-ce.0.tar gitlab-ce:18.1.2-ce.0
   ```

---

## 二、docker-compose 配置

准备 `gitlab.yml`（docker-compose 格式）。核心要点：挂载配置/日志/数据目录、备份目录，映射 HTTP/HTTPS/SSH 端口：

```yaml
services:
  gitlab:
    image: gitlab/gitlab-ce:18.1.2-ce.0   # 社区版镜像
    container_name: gitlab
    hostname: 'gitlab.example.com'        # 替换为你的域名或 IP
    restart: always
    volumes:
      - '/data/gitlab/config:/etc/gitlab'
      - '/data/gitlab/logs:/var/log/gitlab'
      - '/data/gitlab/data:/var/opt/gitlab'
      - '/data/gitlab/backups:/var/opt/gitlab/backups'
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        external_url 'http://gitlab.example.com:8081'
        gitlab_rails['time_zone'] = 'Asia/Shanghai'
        gitlab_rails['lfs_enabled'] = true
        gitlab_rails['gitlab_shell_ssh_port'] = 2222
        nginx['listen_port'] = 8081
    ports:
      - '8081:8081'   # HTTP（与 external_url 端口一致）
      - '443:443'     # HTTPS
      - '2222:22'     # SSH
    shm_size: '2048m' # 防止内存不足崩溃
```

> 提示：`external_url`、`nginx['listen_port']` 与宿主机映射的 HTTP 端口三处需保持一致。

---

## 三、启动与初始化

```bash
docker-compose -f gitlab.yml up -d
```

- 首次启动需约 **5–10 分钟**完成初始化。
- 初始化完成前**不要尝试登录**。
- 若初始化失败，可删除 `config`、`data`、`logs` 目录与容器后重新启动。

查看日志与状态：

```bash
docker logs -f gitlab -n 50
docker inspect gitlab | grep -A2 RestartPolicy
```

---

## 四、配置外部数据库（可选）

生产环境建议使用外部 PostgreSQL。首次可先用内置数据库启动，完成初始化后再切换到外部数据库。

### 4.1 创建数据库与用户

在数据库主节点执行：

```bash
# 创建用户
docker exec pg-master bash -c "psql -U postgres -d postgres -c \"CREATE USER gitlab LOGIN PASSWORD 'your-db-password';\""
# 创建主库
docker exec pg-master bash -c "psql -U postgres -d postgres -c \"CREATE DATABASE gitlabhq_production OWNER gitlab ENCODING = 'UTF8';\""
# 安装扩展
docker exec pg-master bash -c "psql -U gitlab -d gitlabhq_production -c \"CREATE EXTENSION pg_trgm;\""
docker exec pg-master bash -c "psql -U gitlab -d gitlabhq_production -c \"CREATE EXTENSION btree_gist;\""
```

### 4.2 修改 gitlab.rb 连接外部数据库

在 `gitlab/config/gitlab.rb` 中禁用内置数据库并配置外部连接：

```ruby
postgresql['enable'] = false
gitlab_rails['db_adapter'] = "postgresql"
gitlab_rails['db_encoding'] = "utf8"
gitlab_rails['db_database'] = "gitlabhq_production"
gitlab_rails['db_username'] = "gitlab"
gitlab_rails['db_password'] = "your-db-password"
gitlab_rails['db_host'] = "pg-internal.example.com"
gitlab_rails['db_port'] = 5432
```

### 4.3 配置 CI 数据库（双库分离）

GitLab 支持主库与 CI 库分离，在 `gitlab.rb` 中追加：

```ruby
gitlab_rails['env'] = { 'GITLAB_ALLOW_SEPARATE_CI_DATABASE' => 'true' }
gitlab_rails['databases']['ci']['enable'] = true
gitlab_rails['databases']['ci']['db_database'] = 'gitlabhq_production_ci'
gitlab_rails['databases']['ci']['db_host'] = 'pg-internal.example.com'
gitlab_rails['databases']['ci']['db_port'] = 5432
gitlab_rails['databases']['ci']['db_username'] = 'gitlab'
gitlab_rails['databases']['ci']['db_password'] = 'your-db-password'
gitlab_rails['databases']['ci']['db_adapter'] = 'postgresql'
gitlab_rails['databases']['ci']['db_encoding'] = "utf8"
```

> CI 库需以主库为模板创建（`CREATE DATABASE gitlabhq_production_ci WITH TEMPLATE gitlabhq_production OWNER gitlab;`）。

使配置生效：

```bash
docker exec gitlab bash -c "gitlab-ctl reconfigure"
```

---

## 五、常见问题

**数据库迁移失败**（首次启动、接入外部数据库时可能出现）：先禁止自启动，手动迁移后重启：

```bash
docker update --restart=no gitlab
docker exec gitlab bash -c "gitlab-rake db:migrate --trace"
# 待容器停止后重启，系统自动继续迁移；状态 healthy 后再恢复故障重启
docker update --restart=always gitlab
```

**数据库表已存在 / 字段重复**：多为版本兼容问题，换用与目标版本匹配的镜像可规避。

**数据库表 / 关系不存在**（如 `relation "ci_pipelines" does not exist`、`relation "ci_job_artifacts" does not exist`）：多为官方 bug 或 CI 库未正确初始化，换用与目标版本匹配的镜像部署通常可规避。

**用户登录后 500 报错**：多为数据库关系未升级。执行 `gitlab-rake db:migrate:status` 检查迁移状态，再 `gitlab-rake db:migrate`、`gitlab-ctl reconfigure`、`gitlab-ctl restart` 补齐数据库关系。

**OpenSSL::Cipher::CipherError 堆栈错误**：进入 `gitlab-psql` 登录 `gitlabhq_production` 库，重置 runner token 即可：

```sql
UPDATE projects SET runners_token = null, runners_token_encrypted = null;
```

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [组件与集成配置]({{< ref "configuration" >}})。
