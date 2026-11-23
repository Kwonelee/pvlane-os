# PVLANE ARM64 Docker 镜像文件部署

本示例根据 qinzeiwang/pvlane-os 的 master 分支结构编写。
目标是 64 位 ARM Linux（aarch64 / arm64），不是 32 位 arm/v7。
GitHub Actions 构建后提供镜像文件下载，不向 Docker Hub 或 GHCR 推送镜像。

## 放置文件

把本目录中的以下文件复制到项目根目录，保持相对路径：

- Dockerfile：Node.js 22 构建静态文件，Nginx 提供网页。
- .dockerignore：排除本机依赖、构建产物和私有桌面版资料。
- nginx.conf：静态资源、SPA 回退与 PDF.js .mjs MIME 类型。
- .github/workflows/docker.yml：构建 ARM64 镜像并上传为 Actions Artifact。
- compose.yaml：可选，复制到 ARM64 服务器后运行本地导入的镜像。

DEPLOY-ARM64.md 是说明文件，不参与构建。
无需修改 package.json、vite.config.ts 或 package-lock.json。

## GitHub Actions 构建与下载

推送 master、推送 v 开头的标签，或在 Actions 页面手动运行工作流。
如果默认分支改成 main，请同步调整工作流的 branches。
工作流仅需 contents: read 权限，无需配置镜像仓库账号、密码或额外 Secret。
构建过程仍需联网拉取基础镜像、安装 npm 依赖；目标服务器可以离线导入运行。

构建成功后，打开仓库 Actions → 对应的工作流运行记录 → Artifacts，下载
pvlane-arm64-image。GitHub 下载时提供 ZIP 包，先解压，得到：

```text
pvlane-arm64.tar.gz
pvlane-arm64.tar.gz.sha256
```

其中 tar.gz 是包含所有运行层的 Docker 镜像归档，内置镜像标签为 pvlane:arm64。
本示例的 Artifact 保留 14 天，实际也受仓库/组织策略约束，请在到期前下载保存。
这是工作流运行记录中的下载附件，不会自动创建 GitHub Release。

## ARM64 服务器导入运行

将解压得到的上述两个文件和 compose.yaml 复制到 ARM64 服务器的同一目录。
安装带 Compose 插件的 Docker，然后执行：

```sh
# 可选：检查文件传输是否完整。
sha256sum -c pvlane-arm64.tar.gz.sha256

# Docker 可直接加载 gzip 压缩的镜像归档，无需先解压 tar.gz。
docker load -i pvlane-arm64.tar.gz

# 使用已导入的本地镜像启动，不访问镜像仓库。
docker compose up -d --pull never
```

不使用 Compose 也可以运行；下面的命令与 Compose 二选一：

```sh
docker run -d --name pvlane --pull=never --restart unless-stopped -p 8080:80 pvlane:arm64
```

访问 http://服务器IP:8080 可初步检查页面能否加载。
正式使用请在前置反向代理上配置受浏览器信任的 HTTPS，并代理到容器的 80 端口。
本示例的 Nginx 配置本身不包含 HTTPS 证书和 TLS 监听。

项目源码使用 showSaveFilePicker 保存项目 JSON 和报告，需要 Chrome/Edge 和
安全上下文。通过远程服务器或局域网 IP 的普通 HTTP 访问时，这些保存功能会不可用。
localhost 的 HTTP 通常可作为本机调试例外。

本项目使用 /pdfjs/... 绝对路径，请先部署在域名根路径；
如需 /pvlane/ 子路径，需要额外调整 Vite base 和源码内的资源路径。

项目无后端、无数据库；项目文件通过浏览器保存在使用者本机，不需要为项目 JSON
挂载服务器数据卷。3D/WebGL 在使用者的浏览器中执行，服务器不需要 GPU。

## 更新版本

下载新一轮构建的 Artifact，解压并复制到服务器，检查校验和后执行：

```sh
docker load -i pvlane-arm64.tar.gz
docker compose up -d --pull never --force-recreate
```

每次构建均使用 pvlane:arm64 标签，导入会将标签指向新镜像；重新创建容器后生效。

## 构建说明

Dockerfile 的构建阶段使用 BUILDPLATFORM，在 GitHub x86 runner 上生成前端静态文件；
运行阶段使用目标平台的 Nginx 镜像。运行阶段没有 RUN 指令，因此当前方案不需要
QEMU。以后如果在目标平台阶段增加 RUN 指令，则需要原生 ARM runner 或 QEMU。

ELECTRON_SKIP_BINARY_DOWNLOAD=1 仅跳过 Electron 桌面运行时下载；仍保留 Vite、
TypeScript 等网页构建需要的开发依赖。npm run build 会自动先执行 prebuild，
复制 PDF.js 的 cmaps、standard_fonts 和 wasm，不能仅手动执行 vite build 替代。

工作流使用 type=docker 导出可被 docker load 导入的单平台镜像归档。
如需同时提供 x86 镜像，应按平台分别构建、导出不同文件；不要直接在当前导出配置中
把 platforms 改为 linux/amd64,linux/arm64。

## 验证

```sh
docker image inspect pvlane:arm64 --format '{{.Os}}/{{.Architecture}}'
docker compose ps
docker compose logs --tail=50
```

镜像架构输出应为 linux/arm64。通过 HTTPS 在 Chrome/Edge 检查页面、3D、PDF 底图导入、
项目保存和报告保存。项目 JSON 应保存到浏览器使用者本机。

本示例经过项目源码与配置审查，尚未实际执行 Docker 构建或 GitHub Actions。
