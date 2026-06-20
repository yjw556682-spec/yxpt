# yxpt 部署

yxpt MVP 的部署基于 **Docker** —— 这意味着你的代码本身**和云厂商完全解耦**,
同一份 `docker-compose.yml` + `Dockerfile` 可以跑在阿里云、腾讯云、AWS、
Azure,或者你本地笔记本上。

## 选择你的云厂商

- **[腾讯云轻量应用服务器](./README-tencent.md)** — 2C2G 约 30-60 CNY/月,
  香港机房免备案,推荐(性价比最高 + 文档最全)
- **[阿里云轻量应用服务器](./README-aliyun.md)** — 2C2G 约 60 CNY/月,
  内地更快,适合目标用户全在大陆

> 两份手册的差别只在购买引导、控制台防火墙位置、镜像加速器,
> 核心命令(docker compose / nginx / Caddy)完全一致。

## 共通步骤(任选一个云厂商前先做)

**本地先用 Docker 跑一遍验证 —— 5 分钟。** 见任一手册的"第 0 步"段。
这一步能让你在买机器前先确认:
- 我们的 `Dockerfile` 在你机器上能 build(验证 isolated-vm 编译依赖装得上)
- `docker compose` 启动后,`/api/agent/leaderboard` 能返回 200
- 没有未知的本地环境问题

如果这一步都过不去,买云机器肯定也过不去,白白浪费 5 分钟。

## 部署后的运维速查

```bash
# 看日志
docker compose -f deploy/docker-compose.yml logs -f api

# 重启某个服务
docker compose -f deploy/docker-compose.yml restart api

# 备份
docker compose -f deploy/docker-compose.yml exec -T db \
  pg_dump -U yxpt yxpt | gzip > backup-$(date +%Y%m%d).sql.gz

# 升级
git pull && pnpm install && pnpm build && \
  docker compose -f deploy/docker-compose.yml up -d --build && \
  cp -r packages/web/dist/* /var/www/yxpt/
```

## 监控建议(MVP 之后)

- 接入腾讯云/阿里云的"云监控",看 CPU/内存/带宽
- 跑个简单的 uptime check: cron + curl `/api/agent/leaderboard`
- 看 access log(Nginx) 判断流量来源

## 安全备忘

- **永远不要**把 postgres 端口 (5432) 暴露到公网
- **永远不要**把 api 端口 (3000) 暴露到公网(只通过 Nginx 反代)
- 改默认 `ADMIN_TOKEN` 和 `POSTGRES_PASSWORD`
- SSH 改用密钥登录、关掉密码登录:`/etc/ssh/sshd_config` 里 `PasswordAuthentication no`
