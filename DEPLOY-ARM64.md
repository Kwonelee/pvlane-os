# PVLANE ARM64 Docker 部署

本示例根据 qinzeiwang/pvlane-os 的 master 分支结构编写。
目标是 64 位 ARM Linux（aarch64 / arm64），不是 32 位 arm/v7。

## 放置文件

把本目录中的以下文件复制到项目根目录，保持相对路径：

- Dockerfile：Node.js 22 构建静态文件，Nginx 提供网页。
- .dockerignore：排除本机依赖、构建产物和私有桌面版资料。
- nginx.conf：静态资源、SPA 回退与 PDF.js .mjs MIME 类型。
- .github/workflows/docker.yml：构建并发布 ARM64 镜像到 GHCR。
- compose.yaml：可选，复制到 ARM64 服务器后拉取运行。

DEPLOY-ARM64.md 是说明文件，不参与构建。
无需修改 package.json、vite.config.ts 或 package-lock.json。

## GitHub Actions 发布

推送 master、推送 v 开头的标签，或在 Actions 页面手动运行工作流。
默认分支构建生成 latest；同时生成 sha 标签；Git 标签构建生成同名镜像标签。
例如 v0.3.0 对应 ghcr.io/qinzeiwang/pvlane-os:v0.3.0。

工作流使用仓库自带的 GITHUB_TOKEN，不需要另建 GHCR 密码 Secret。
仓库或组织策略必须允许 GitHub Actions 写入 Packages。
首次发布后如需在服务器匿名拉取，到 GitHub Packages 的包设置中将包改为 Public；
公开仓库生成的包也不一定自动公开。私有包需在服务器使用具有 read:packages
权限的凭据执行 docker login ghcr.io。

如果复制到自己的 fork，工作流会自动按 fork 的 owner/repo 命名镜像，
还需要把 compose.yaml 中的 image 改成对应地址。
如果默认分支改成 main，请同步调整工作流的 branches。

## ARM64 服务器运行

安装带 Compose 插件的 Docker，然后在 compose.yaml 所在目录执行：

```sh
docker compose pull
docker compose up -d
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

## 构建说明

Dockerfile 的构建阶段使用 BUILDPLATFORM，在 GitHub x86 runner 上生成前端静态文件；
运行阶段使用目标平台的 Nginx 镜像。运行阶段没有 RUN 指令，因此当前方案不需要
QEMU。以后如果在目标平台阶段增加 RUN 指令，则需要原生 ARM runner 或 QEMU。

ELECTRON_SKIP_BINARY_DOWNLOAD=1 仅跳过 Electron 桌面运行时下载；仍保留 Vite、
TypeScript 等网页构建需要的开发依赖。npm run build 会自动先执行 prebuild，
复制 PDF.js 的 cmaps、standard_fonts 和 wasm，不能仅手动执行 vite build 替代。

如果要同时支持 x86 和 ARM，将工作流中的 platforms 改为：

```yaml
platforms: linux/amd64,linux/arm64
```

多架构镜像让 Docker 自动选择平台；这种情况下可删除 compose.yaml 中的 platform，
使同一份 Compose 文件也能在 x86 上运行。

## 验证

```sh
docker buildx imagetools inspect ghcr.io/qinzeiwang/pvlane-os:latest
docker compose ps
docker compose logs --tail=50
```

镜像清单中应包含 linux/arm64。通过 HTTPS 在 Chrome/Edge 检查页面、3D、PDF 底图导入、
项目保存和报告保存。项目 JSON 应保存到浏览器使用者本机。

本示例经过项目源码与配置审查，尚未实际执行 Docker 构建或 GitHub Actions。
