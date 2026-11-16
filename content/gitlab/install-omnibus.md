+++
title = "GitLab 安装 · Omnibus 部署"
date = 2025-03-24T10:10:00+08:00
draft = false
author = ""
keywords = ["gitlab", "omnibus", "安装", "linux", "包安装"]
summary = "使用 Omnibus（传统 Linux 包安装）方式部署 GitLab CE 的过程、配置与常用命令。"
tags = ["gitlab", "omnibus", "install"]
+++

# GitLab 安装 · Omnibus 部署

Omnibus 是 GitLab 官方的传统 Linux 包安装方式，将应用、数据库、Nginx、Redis 等组件打包在一个软件包中，通过 `/etc/gitlab/gitlab.rb` 统一配置。适合单机或裸机 + 共享存储的环境。

> 本系列文档中用 **gitlab-omnibus** 简称此部署方式。所有示例域名、密码、IP 均为占位符。

<!--more-->

---

## 一、安装前提

- 一台 Linux 主机（建议至少 4C/8G，具体视用户规模）。
- 可访问 GitLab 软件源或镜像源。
- 服务器能解析到目标域名，并开放 80/443（HTTP/HTTPS）与 22（SSH）端口。

---

## 二、安装步骤

### 2.1 配置软件源并安装

以 Debian/Ubuntu 为例（使用清华镜像源加速）：

```bash
# 添加 GitLab 软件源
curl -fsSL https://mirror.tuna.tsinghua.edu.cn/gitlab-ce/gitlab-ce/script.deb.sh | bash

# 安装社区版
sudo EXTERNAL_URL="http://gitlab.example.com" apt-get install gitlab-ce
```

> `EXTERNAL_URL` 会写入 `/etc/gitlab/gitlab.rb` 的 `external_url`，是 GitLab 对外访问地址。

### 2.2 初始配置与生效

安装完成后，如需修改配置，编辑 `/etc/gitlab/gitlab.rb`：

```ruby
external_url 'http://gitlab.example.com'
gitlab_rails['time_zone'] = 'Asia/Shanghai'
```

使配置生效：

```bash
sudo gitlab-ctl reconfigure
```

首次 reconfigure 会完成初始化，耗时数分钟。初始化完成前不要尝试登录。

---

## 三、首次登录与密码

1. 浏览器访问 `external_url` 配置的地址。
2. 首次登录用户名为 `root`，密码需要自己设置：

```bash
sudo gitlab-rails console -e production
```

在控制台内执行：

```ruby
user = User.where(id: 1).first
user.password = 'your-strong-password'
user.password_confirmation = 'your-strong-password'
user.save!
```

退出控制台后即可用新密码登录，登录后建议关闭自注册、完善管理员邮箱等。

---

## 四、常用运维命令

| 命令 | 作用 |
| --- | --- |
| `sudo gitlab-ctl status` | 查看各组件运行状态 |
| `sudo gitlab-ctl restart` | 重启所有组件 |
| `sudo gitlab-ctl tail` | 实时跟踪日志 |
| `sudo gitlab-ctl reconfigure` | 重新生成配置并生效 |
| `sudo gitlab-rake gitlab:check` | 环境自检 |
| `sudo gitlab-ctl stop` / `start` | 停止 / 启动 |

---

## 五、说明

- Omnibus 方式把数据库、Redis、Nginx 等组件都内置，配置集中在 `gitlab.rb`。
- 如需使用外部数据库（PostgreSQL），见 [组件与集成配置]({{< ref "configuration" >}}) 的数据库章节。
- 备份与恢复命令见 [数据备份]({{< ref "backup" >}}) 与 [数据恢复]({{< ref "recover" >}})。

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航。
