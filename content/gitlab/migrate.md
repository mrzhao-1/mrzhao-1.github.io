+++
title = "GitLab 数据迁移与项目导入"
date = 2025-03-24T10:40:00+08:00
draft = false
author = ""
keywords = ["gitlab", "迁移", "migrate", "存储迁移", "svn", "导入"]
summary = "GitLab 仓库存储迁移、SVN 迁移与项目导入的方法与最佳实践。"
tags = ["gitlab", "migrate"]
+++

# GitLab 数据迁移与项目导入

本文介绍 GitLab 的仓库存储迁移、SVN 迁移与项目导入。迁移前务必创建完整备份并准备 API 访问令牌。

<!--more-->

---

## 一、仓库存储迁移

### 1.1 场景一：存储节点间转移（推荐）

在已配置的多个存储节点间移动项目（重新平衡磁盘负载）。通过 API 发起，GitLab 后台处理，项目短暂只读后自动恢复。

```bash
# 批量迁移所有项目
curl --request POST \
  --header "PRIVATE-TOKEN: <your_access_token>" \
  --header "Content-Type: application/json" \
  --data '{"source_storage_name":"default","destination_storage_name":"storage2"}' \
  "https://gitlab.example.com/api/v4/project_repository_storage_moves"

# 迁移单个项目
curl --request POST \
  --header "PRIVATE-TOKEN: <your_access_token>" \
  "https://gitlab.example.com/api/v4/projects/<project_id>/repository_storage_moves?destination_storage_name=storage2"

# 查询迁移状态（state 为 finished 即成功）
curl --header "PRIVATE-TOKEN: <your_access_token>" \
  "https://gitlab.example.com/api/v4/project_repository_storage_moves"
```

### 1.2 场景二：更改整体存储路径

将整个数据目录迁移到更大磁盘（需停机维护窗口）：

```bash
sudo gitlab-ctl stop
sudo rsync -av /var/opt/gitlab/ /mnt/new_storage/
# 修改 gitlab.rb 中 git_data_dirs 路径后：
sudo gitlab-ctl reconfigure
sudo gitlab-ctl start
```

### 1.3 场景三：迁移至对象存储

为 CI 产物、LFS 等配置对象存储（S3/MinIO），使用 `gitlab-rake "gitlab:packages:migrate"` 迁移现有数据。

> 建议：优先使用 API 方式（安全、中断小）；整体迁移需停机，安排在维护窗口；无论哪种方式都保留旧数据以便回滚。

---

## 二、SVN 迁移

将 SVN 项目迁移到 GitLab，使用 `git svn` 克隆后推送：

```bash
git svn clone <svn-repo-url> --stdlayout --no-metadata --authors-file=authors.txt <target-dir>
cd <target-dir>
git remote add origin git@gitlab.example.com:<group>/<project>.git
git push -u origin --all
git push -u origin --tags
```

> 需要预先准备 `authors.txt` 映射 SVN 用户名到 Git 作者邮箱。

---

## 三、项目导入

### 3.1 从 GitHub 导入

1. 在 GitHub 生成 Personal Access Token（勾选 `repo` 权限）。
2. GitLab 项目 → New project → Import project → GitHub，填入 Token 完成导入。

### 3.2 上传本地项目

- 先在 GitLab 创建空项目（不要勾选 README 初始化）。
- 本地仓库添加远程并推送：

```bash
git remote add origin git@gitlab.example.com:<group>/<project>.git
git push --all origin
git push --tags origin
git push --set-upstream origin main
```

### 3.3 镜像仓库（导入公共项目）

对公共开源项目做镜像时，若导入不完整，可先 `git clone --mirror` 公共仓库到目标路径，再定期 `remote update` 同步。

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [平台使用与 Redmine 集成]({{< ref "platform-usage" >}})。
