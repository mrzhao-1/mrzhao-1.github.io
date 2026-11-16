+++
title = "GitLab 平台使用与 Redmine 集成"
date = 2025-03-24T10:45:00+08:00
draft = false
author = ""
keywords = ["gitlab", "redmine", "权限", "角色", "镜像仓库", "webhook", "ci"]
summary = "GitLab 的组与项目、角色权限、镜像仓库同步、保护分支，以及与 Redmine 缺陷跟踪系统的集成。"
tags = ["gitlab", "redmine", "usage"]
+++

# GitLab 平台使用与 Redmine 集成

本文介绍 GitLab 的日常平台使用：组与项目组织、角色权限、镜像仓库同步、保护分支，以及与 Redmine 缺陷跟踪系统的集成。

<!--more-->

---

## 一、组与项目（Namespace）

按团队/产品划分 Group（命名空间），并在组内建立子组形成层级。典型结构：

```text
Infra          # 基础设施代码、DevOps、机房管理
buss           # 业务项目
  ├── storage
  └── filesystem
archive        # 归档项目（停止维护的旧系统）
research       # 研究性项目
```

创建组后，为各项目组指派 maintainers。

---

## 二、角色与权限

### 2.1 GitLab 角色

| 角色 | 权限要点 |
| --- | --- |
| **Guest**（访客） | 查看公开议题与 Wiki，不能接触代码 |
| **Reporter**（报告者） | 全面查看代码与项目活动、提交问题，不能改代码 |
| **Developer**（开发者） | 开发工程师默认角色，可推送非保护分支、创建 MR |
| **Maintainer**（维护者） | 推送保护分支、管理 MR、添加成员、编辑设置 |
| **Owner**（所有者） | 全部权限，可删除项目、转移命名空间 |

配置原则：

- **权限叠加取最高**：用户同时属于项目组和项目时，取最高权限。
- **先访问权限，再行为权限**：项目可见性（Private/Internal/Public）是第一道门槛。
- **善用保护分支**：精细控制谁可 push/merge。

### 2.2 Redmine 角色

| 角色 | 主要权限 |
| --- | --- |
| 管理员（Manager） | 所有权限，含创建项目、管理成员、管理版本 |
| 开发人员（Developer） | 处理问题、提交代码、查看文档 |
| 报告人员（Reporter） | 查看项目、创建/评论问题，不能修改他人问题 |
| 非成员用户（Non-member） | 权限由管理员单独配置 |

---

## 三、镜像仓库同步

### 3.1 定位仓库路径

GitLab 按项目 ID 的 SHA256 哈希存储仓库路径。项目 ID 在设置页可见：

```bash
echo -n <项目ID> | sha256sum
```

哈希值前几位按两个字符一组构成目录树，即为仓库路径（`@hashed/xx/yy/<hash>.git`）。

### 3.2 同步远程公共仓库到 GitLab 项目

先在容器内添加安全目录，再用 `git` 用户操作裸仓库：

```bash
docker exec -it gitlab bash -c \
  "git config --global --add safe.directory \
    /var/opt/gitlab/git-data/repositories/@hashed/xx/yy/<hash>.git"
```

**裸仓库同步**（优先使用 `git fetch`）：

```bash
su -- git -c "/opt/gitlab/embedded/bin/git \
  --git-dir=/var/opt/gitlab/git-data/repositories/@hashed/xx/yy/<hash>.git \
  remote update origin"
```

**强制更新本地分支引用**：

```bash
su -- git -c "/opt/gitlab/embedded/bin/git \
  --git-dir=.../<hash>.git \
  update-ref refs/heads/master refs/remotes/origin/master"
```

> 批量同步所有分支可写成脚本循环 `update-ref`；需完全覆盖时谨慎使用 `fetch origin +refs/heads/*:refs/heads/* --prune`（会影响自研分支）。

**常见问题**：

- `fatal: not a git repository`：`--git-dir` 路径错误或权限不足。
- `fatal: refusing to update checked out branch`：裸仓库默认拒绝直接改当前分支，用 `update-ref` 代替。
- 远程地址丢失：`git remote set-url origin <url>` 重新设置。

---

## 四、保护分支

对公共仓库同步的分支设置保护，避免同步操作误改：

项目 → Settings → Repository → Branch rules → Add branch rule，以通配符添加（如 `*-stable`、`production/*`），将 master 与通配规则设为仅 Administrators 可 push/merge，并禁止强制 push。

---

## 五、Redmine 集成

### 5.1 整体流程

1. 创建 GitLab 版本跟踪项目。
2. 配置项目权限与相关设置。
3. 创建 Redmine 缺陷跟踪项目（用 GitLab 项目名作名称/标识，主页指向 GitLab 项目）。
4. 配置 Redmine 版本库（先克隆 Git 项目到 Redmine 环境）。
5. 配置 GitLab → Redmine 集成（webhook）。
6. 测试集成。

### 5.2 Redmine 侧配置

- 管理 → 配置 → API：打开 REST web service，保存。
- 管理 → 配置 → 版本库：SCM 选 git，开启自动获取变更与 web service，生成版本管理 API 秘钥（`redmine_ws_api_key`）。
- 配置 Issue 关键词（跟踪标签）：检测 commit log 中匹配的关键词来修改 Issue 状态。

### 5.3 GitLab → Redmine webhook

在 commit 日志中使用格式：`[关键词] [空格] #[问题单号] @某人`，例如 `start #22 @dev` 可修改第 22 个 Issue 状态并抄送。

在 GitLab 项目添加 webhook，将消息推送到 Redmine：

```text
http://redmine.example.com:8082/gitlab_hook?key=<redmine_api_key>&project_id=<redmine_project_id>
```

测试：

```bash
curl -X POST -I "http://redmine.example.com/gitlab_hook?key=<redmine_api_key>&project_id=<redmine_project_id>"
```

### 5.4 常见问题

- **Host key verification failed**：将 Redmine 账户的 SSH key 添加到 GitLab，并在 Redmine 环境用对应账户手动 fetch 一次以信任主机。
- **404 / 406**：确认使用 POST 方法，且 `project_id` 与 key 正确。

---

## 六、CI/CD 与后续

- 内置 CI/CD 通过 `.gitlab-ci.yml` 定义流水线。
- GitLab Runner 负责执行 Job，缓存可配置到 S3 对象存储（见 [安装 · Kubernetes]({{< ref "install-k8s" >}})）。
- 后续可扩展：Pgpool-II 读写分离、Jenkins 集成、代码质量审查工具集成。

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航。
