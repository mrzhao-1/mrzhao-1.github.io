+++
title = "GitLab 组件与集成配置"
date = 2025-03-24T10:25:00+08:00
draft = false
author = ""
keywords = ["gitlab", "配置", "ldap", "smtp", "gravatar", "ssh", "数据库"]
summary = "GitLab 的数据库、LDAP/AD、SMTP 邮件、Gravatar、SSH Keys、注册与遥测等组件与集成配置。"
tags = ["gitlab", "configuration", "ldap", "smtp"]
+++

# GitLab 组件与集成配置

本文介绍 GitLab 部署完成后的组件与集成配置，覆盖数据库、LDAP/AD 域认证、SMTP 邮件、Gravatar、SSH Keys、注册限制与遥测开关。配置主要位于 `/etc/gitlab/gitlab.rb`（Omnibus/Docker），修改后执行 `gitlab-ctl reconfigure` 生效。

> 所有域名、密码、邮箱均为占位符。

<!--more-->

---

## 一、数据库配置

详见 [安装 · Docker]({{< ref "install-docker" >}}) 或 [安装 · Kubernetes]({{< ref "install-k8s" >}}) 中对应部署方式的数据库章节。核心要点：

- 生产环境建议使用外部 PostgreSQL，禁用内置 `postgresql['enable'] = false`。
- 支持主库与 CI 库分离（`GITLAB_ALLOW_SEPARATE_CI_DATABASE`）。
- 修改后务必先 `gitlab-ctl reconfigure`，再验证连接：`sudo gitlab-rails dbconsole`。

---

## 二、LDAP / AD 域认证

在 `gitlab.rb` 的 `### LDAP Settings` 之后追加：

```ruby
gitlab_rails['ldap_enabled'] = true
gitlab_rails['ldap_servers'] = YAML.load <<-'EOS'
  main:
    label: 'LDAP'
    host: 'ad.example.com'
    port: 389
    uid: 'sAMAccountName'
    bind_dn: 'administrator@example.com'
    password: 'your-ldap-password'
    encryption: 'plain'
    verify_certificates: false
    active_directory: true
    allow_username_or_email_login: true
    block_auto_created_users: false
    base: 'ou=users,dc=example,dc=com'
    user_filter: '(&(objectCategory=Person)(sAMAccountName=*))'
EOS
```

生效并测试：

```bash
gitlab-ctl reconfigure
gitlab-rake gitlab:ldap:check
```

获取 AD 域用户列表、手动测试搜索：

```bash
gitlab-rake gitlab:tasks
sudo gitlab-rails runner '
  result = Gitlab::Auth::Ldap::Adapter.new("main").search("(sAMAccountName=testuser)")
  puts result.inspect
'
```

---

## 三、SMTP 邮件配置

在 `gitlab.rb` 的 `### Email Settings` 之后追加：

```ruby
gitlab_rails['gitlab_email_from'] = 'gitlab@example.com'
gitlab_rails['gitlab_email_display_name'] = 'GitLab Admin'
gitlab_rails['gitlab_email_reply_to'] = 'gitlab@example.com'
gitlab_rails['smtp_enable'] = true
gitlab_rails['smtp_address'] = "smtp.example.com"
gitlab_rails['smtp_port'] = 465
gitlab_rails['smtp_user_name'] = "gitlab@example.com"
gitlab_rails['smtp_password'] = "your-smtp-password"
gitlab_rails['smtp_domain'] = "example.com"
gitlab_rails['smtp_authentication'] = "login"
gitlab_rails['smtp_enable_starttls_auto'] = false
gitlab_rails['smtp_tls'] = true
```

测试邮件发送（在 Rails 控制台中）：

```ruby
email = Notify.test_email('admin@example.com', 'test Gitlab Email', 'Test')
email.deliver_now
```

---

## 四、禁用 Gravatar（内网头像超时）

内网无法访问 Gravatar 时会导致页面卡顿与超时。禁用并改用本地头像：

```ruby
gitlab_rails['gravatar_enabled'] = false
```

保存后 `gitlab-ctl reconfigure`（Docker 环境需重启容器）。之后用户头像由 GitLab 在本地生成 identicon 图案，不再有外部请求。

---

## 五、SSH Keys

账户 → SSH Keys → Add new key：将客户端 `~/.ssh/id_rsa.pub` 内容粘贴并添加，后续该机器对 Git 的 SSH 操作无需密码。

---

## 六、注册与用户设置

| 设置 | 路径 | 建议 |
| --- | --- | --- |
| 禁用自注册 | Admin → Settings → General → Sign-up restrictions → Sign-up enabled | 关闭 |
| 新注册需管理员批准 | Sign-up restrictions → Require admin approval | 按需 |
| 邮件确认 | Sign-up restrictions → Email confirmation settings → Hard | 开启 |
| Web 终端超时 | Admin → Settings → General → Web terminal | 240 分钟 |

---

## 七、Issues 与合并请求默认项

- **全局禁用 Issues**：`gitlab_rails['gitlab_default_projects_features_issues'] = false`；或按项目在 Settings → Visibility 中关闭。
- **合并请求默认不删除源分支**：项目 → Settings → Merge requests → 取消勾选 "Delete source branch" option by default。
- **自动解决过时 diff 讨论**：勾选 "Automatically resolve merge request diff threads when they become outdated"。

---

## 八、关闭遥测数据收集

内网无法连通 GitLab 遥测主机时日志会出现报错，关闭即可：

```ruby
gitlab_rails['usage_ping_enabled'] = false
gitlab_rails['sentry_enabled'] = false
gitlab_rails['product_intelligence_enabled'] = false
```

---

## 九、GitLab Pages

启用 Pages 服务并设置外部访问地址（无泛域名 DNS 时开启 `namespace_in_path`）：

```ruby
pages_external_url "https://pages.example.com"
gitlab_pages['enable'] = true
gitlab_pages['namespace_in_path'] = true
```

---

## 十、Web IDE 问题

若 Web IDE 报「File system provider ... is not available」，多为 VS Code Extension Marketplace 导致。在 Admin → Settings → General → VS Code Extension Marketplace 中禁用即可。

---

回到 [总览]({{< ref "/post/gitlab-guide" >}}) 查看完整文档导航，或继续阅读 [数据备份]({{< ref "backup" >}})。
