+++
title = "Kubernetes 高可用配置"
date = 2024-11-07T09:23:27+08:00
draft = false
author = ""
keywords = ["kubernetes", "k8s", "高可用", "haproxy", "keepalived", "vip"]
summary = "使用 haproxy + keepalived 为 kube-apiserver 提供负载均衡与 VIP，实现控制面高可用。"
tags = ["k8s", "kubernetes", "ha", "haproxy", "keepalived"]
+++

# Kubernetes 高可用配置

二进制安装的控制面高可用，用 **haproxy** 做 apiserver 的负载均衡、**keepalived** 做 VIP 漂移。所有 IP、VIP、主机名均为占位符。

<!--more-->

---

## 一、安装 haproxy 与 keepalived

```bash
yum install -y haproxy keepalived
# Ubuntu: apt install -y haproxy keepalived
```

---

## 二、配置 haproxy

```bash
cat > /etc/haproxy/haproxy.cfg <<EOF
global
  log /dev/log local0

defaults
  mode tcp
  timeout connect 5000ms
  timeout client 50000ms
  timeout server 50000ms

frontend k8s-apiserver
  bind *:6443
  default_backend k8s-apiserver

backend k8s-apiserver
  balance roundrobin
  server master01 <master01-IP>:6443 check
  server master02 <master02-IP>:6443 check
  server master03 <master03-IP>:6443 check
EOF

systemctl enable --now haproxy
systemctl status haproxy
```

> 若使用 haproxy + keepalived，各组件 kubeconfig 的 server 指向 `https://<VIP>:6443`；若使用 nginx 方案，则指向 `https://127.0.0.1:8443`。

---

## 三、配置 keepalived

```bash
cat > /etc/keepalived/keepalived.conf <<EOF
vrrp_instance VI_1 {
    state MASTER            # 备节点改为 BACKUP
    interface <网卡名>
    virtual_router_id 51
    priority 100           # 备节点调低，如 90
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass <密码>
    }
    virtual_ipaddress {
        <VIP>
    }
}
EOF

systemctl enable --now keepalived
systemctl status keepalived
```

---

## 四、验证

```bash
# VIP 可 ping 通
ping -c 3 <VIP>

# VIP 端口可访问
telnet <VIP> 6443

# 关闭主节点，观察 VIP 是否漂移到备节点
```

---

回到 [总览]({{< ref "/post/k8s-guide" >}}) 查看完整文档导航，或继续阅读 [迁移环境配置]({{< ref "migration" >}})。
