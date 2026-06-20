# yxpt 腾讯云轻量部署手册

> 目标: 把 yxpt MVP 部署到 **腾讯云轻量应用服务器**(2C2G,约 30-60 CNY/月,
> 活动价或学生价能低到 10-30 元)。全过程约 30-60 分钟(其中备案不在此范围内,
> 香港/海外机房免备案)。
>
> 如果你先要"在腾讯云上试一下但不绑域名",用 **腾讯云轻量香港机房**,
> 免备案,IP 直接访问,5 分钟可上线。

## 0. 部署前先在本地用 Docker 跑一遍(强烈建议,5 分钟)

这一段是**云平台无关的**。不管你最后用阿里云还是腾讯云,先在本地确认 docker-compose
能起来,再去买机器照抄命令。

```bash
# 在你的本地电脑(项目根目录)上:
cd yxpt
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env,把 POSTGRES_PASSWORD 改成一个临时强密码
# 然后:
DATABASE_URL=postgresql://yxpt:你的密码@db:5432/yxpt \
  docker compose -f deploy/docker-compose.yml up --build
# 看到 api 容器打印 "yxpt server on http://0.0.0.0:3000" 即可。
# 浏览器开 http://localhost:3000/api/agent/leaderboard?mode=grid-duel
# 能看到 {"rankings":[]} 就说明后端跑起来了。
# Ctrl-C 关掉,确认无报错再继续。
```

## 1. 购买腾讯云轻量应用服务器

1. 去 https://console.cloud.tencent.com/lighthouse 登录(没有账号先注册,学生可以做实名)
2. **新建实例**,推荐配置:
   - **地域**: 香港(免备案,即时可用)或 新加坡;内地机房需 ICP 备案(7-20 天)
   - **镜像**: **Ubuntu 22.04 LTS**(社区支持最好,Docker 装起来最顺)
   - **套餐**: 2核 2GB(够 MVP);后面并发高了再升 4C4G
   - **带宽**: 5 Mbps 足够
   - **登录方式**: 自定义密码(记住!)
3. 下单付款,几分钟后实例就绪。记下 **公网 IP**。

## 2. 第一件事:配置腾讯云防火墙(控制台)

> **最容易忘的一步。** 实例**内部**的防火墙和腾讯云**控制台**的"防火墙"是两层,
> 你必须**两边都开 80/443**,外部才能访问。

1. 在轻量控制台,点进你的实例 → 左侧 **"防火墙"** 标签
2. 点击 **"添加规则"**:
   - 协议: TCP, 端口: 80, 策略: 允许, 备注: HTTP
   - 协议: TCP, 端口: 443, 策略: 允许, 备注: HTTPS
   - 协议: TCP, 端口: 22, 策略: 允许(默认就有,但确认一下)
3. **不要** 开放 3000(api 端口)和 5432(postgres 端口)给公网 —— 这两个只走 Docker 网络。

## 3. SSH 进去,装 Docker

```bash
# 从你的本地电脑 SSH 进去(把 1.2.3.4 换成你的公网 IP)
ssh root@1.2.3.4

# 系统更新
apt update && apt upgrade -y

# 装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install -y docker-compose-plugin

# 验证
docker --version
docker compose version

# (可选但推荐) 配置腾讯云 Docker 镜像加速
# 路径: 腾讯云控制台 -> 容器镜像服务 -> 个人版 -> 镜像加速器
# 拿到一个 https://mirror.ccs.tencentyun.com 地址后:
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
EOF
systemctl restart docker
```

## 4. 拉代码、配置环境

```bash
# 装 git
apt install -y git

# 拉代码(如果是私有仓库,先配置 SSH key)
git clone https://github.com/你的用户名/yxpt.git
cd yxpt

# 如果你还没 push 到 GitHub,本地 build 好,scp 上去
# 本地执行:
#   pnpm install && pnpm build
#   scp -r . root@1.2.3.4:/root/yxpt

# 配置部署环境变量
cp deploy/.env.example deploy/.env
nano deploy/.env
```

**deploy/.env 关键变量:**

```bash
# Postgres(被 api 容器用,密码别用默认)
POSTGRES_USER=yxpt
POSTGRES_PASSWORD=用 openssl rand -base64 32 生成一个强密码
POSTGRES_DB=yxpt
DATABASE_URL=postgresql://yxpt:用上面那个密码@db:5432/yxpt

# 服务端
NODE_ENV=production
PORT=3000
ADMIN_TOKEN=再生成一个 32 字节随机串
```

## 5. 启动服务

```bash
cd /root/yxpt
docker compose -f deploy/docker-compose.yml up -d --build

# 看日志确认启动成功
docker compose -f deploy/docker-compose.yml logs -f api
# 等到出现 "yxpt server on http://0.0.0.0:3000",Ctrl-C 退出 logs -f

# 验证后端能访问(在服务器上 curl 自己)
curl http://127.0.0.1:3000/api/agent/leaderboard?mode=grid-duel
# 期望: {"rankings":[]}
```

## 6. 装 Nginx 反向代理 + 准备前端

```bash
# 装 Nginx
apt install -y nginx

# 把前端 dist 放到 Nginx 默认目录
cp -r packages/web/dist/* /var/www/yxpt/

# 用 deploy/nginx.conf.example 作为参考,写一个简单配置
nano /etc/nginx/sites-available/yxpt
```

**最小 nginx 配置(`/etc/nginx/sites-available/yxpt`):**

```nginx
server {
    listen 80 default_server;
    server_name _;   # 或者写你的域名,没域名就下划线兜底

    # 前端静态文件
    root /var/www/yxpt;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback
    }

    # API 反代到 Docker 容器内的 api 服务
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# 启用配置
ln -sf /etc/nginx/sites-available/yxpt /etc/nginx/sites-enabled/yxpt
rm -f /etc/nginx/sites-enabled/default
nginx -t              # 检查配置语法
systemctl reload nginx
```

## 7. 验证公网访问

在**你本地电脑**的浏览器打开:
- `http://1.2.3.4/` → 应该看到 yxpt 落地页
- `http://1.2.3.4/play` → 应该看到 BotPlayPage
- `http://1.2.3.4/leaderboard` → 应该看到排行榜
- `http://1.2.3.4/api/agent/leaderboard?mode=grid-duel` → 应该看到 JSON

## 8. SSL / HTTPS(可选但强烈推荐)

两种方式二选一,选 **Caddy** 的最省事:

```bash
# 装 Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/deb.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Caddyfile
cat > /etc/caddy/Caddyfile << 'EOF'
你的域名.com {
    encode zstd gzip
    root * /var/www/yxpt
    try_files {path} /index.html
    reverse_proxy /api/* 127.0.0.1:3000
}
EOF

systemctl reload caddy
# 完事。Caddy 自动申请 Let's Encrypt 证书,90 天自动续。
```

**前提**:你的域名 `A 记录` 指向 1.2.3.4;**腾讯云香港机房可免备案**用国际版域名;
**内地机房需要 ICP 备案** 否则 Caddy 申请证书会失败(Let's Encrypt 在大陆被墙)。

## 9. 更新部署

代码改了之后:

```bash
ssh root@1.2.3.4
cd /root/yxpt
git pull                    # 拉新代码
pnpm install                # 装新依赖
pnpm build                  # 重新编译
docker compose -f deploy/docker-compose.yml build api
docker compose -f deploy/docker-compose.yml up -d
# 重新拷贝前端
cp -r packages/web/dist/* /var/www/yxpt/
```

## 10. 备份

```bash
# 备份 postgres 数据(每周跑一次或加 cron)
docker compose -f deploy/docker-compose.yml exec -T db \
  pg_dump -U yxpt yxpt | gzip > /root/yxpt-backup-$(date +%Y%m%d).sql.gz

# 恢复
gunzip -c yxpt-backup-20260620.sql.gz | \
  docker compose -f deploy/docker-compose.yml exec -T db psql -U yxpt -d yxpt
```

## 11. 成本核算

| 项目 | 费用 | 备注 |
|------|------|------|
| 腾讯云轻量 2C2G(香港) | ~30-60 CNY/月 | 活动/学生价更低 |
| 域名(可选) | ~60-80 CNY/年 | .cn 约 30/年, .com 约 70/年 |
| SSL | 0 | Let's Encrypt via Caddy |
| Postgres | 0 | 跑在同一台机器的 Docker 容器里 |
| 前端 CDN | 0 | 直接 Nginx 服务,学生项目完全够 |
| **总计** | **~360-800 CNY/年** | 内地机房加备案后也这个价 |

## 12. 排错速查

| 症状 | 原因 | 修复 |
|------|------|------|
| 浏览器访问公网 IP 502 | Nginx 没起来 / api 容器挂了 | `systemctl status nginx` + `docker compose ps` |
| `curl http://127.0.0.1:3000` 在服务器上能访问,但公网 IP 不能 | 腾讯云控制台防火墙没开 80/443 | 回第 2 步 |
| `docker compose up` 报 `isolated-vm` 编译错 | 镜像缺 python3/make/g++ | Dockerfile 已装,确认 --build 时拉了最新 |
| API 返回 401 但你带了 key | key 的 hash 在数据库里没对上 | 重注册一个新用户 |
| `pg_dump` 报 `FATAL: password authentication failed` | .env 密码和 db 容器不一致 | `docker compose down -v` 然后改 .env 再 up |
| Caddy 申请证书失败 | 域名没解析到 IP / 内地机房未备案 | 用 IP 直接访问(无 SSL)或换香港机房 |
