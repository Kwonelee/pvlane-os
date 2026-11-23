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
- index.html：替换项目入口，通过 bootstrap.ts 先加载兼容实现。
- src/bootstrap.ts、src/crypto-compat.ts：新增文件，修复局域网 HTTP 下因
  crypto.randomUUID 不可用而白屏的问题；已有原生实现的浏览器保持使用原生实现。
- src/download-file.ts：新增普通浏览器下载方式，兼容 HTTP。
- src/workspace-file.ts、src/scheme-report.ts、src/main.tsx：替换现有文件，启用项目和
  报告下载，并调整提示和新建项目流程。
- src/download-file.test.ts、src/workspace-save.test.ts：新增或替换相关回归测试。

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
pvlane-arm64.tar
pvlane-arm64.tar.sha256
```

其中 .tar 是未经过 gzip 压缩、包含所有运行层的 Docker 镜像归档，内置镜像标签为 pvlane:arm64。
解压外层 ZIP 后即可取得 .tar，不要继续解包 .tar 内的文件。
本示例的 Artifact 保留 14 天，实际也受仓库/组织策略约束，请在到期前下载保存。
这是工作流运行记录中的下载附件，不会自动创建 GitHub Release。

## 飞牛界面导入

将 pvlane-arm64.tar 上传至飞牛设备，在 Docker 的镜像导入界面选择该 .tar 文件。
导入完成后，使用本地镜像 pvlane:arm64 创建容器，将主机 8080 端口映射到容器 80 端口。
镜像标签可能在界面中分开显示为镜像名称 pvlane、标签 arm64。
此工作流生成的是 ARM64 镜像，设备的处理器必须为 ARM64。

若已有旧版 pvlane-arm64.tar.gz，只需解开 gzip 这一层得到 pvlane-arm64.tar 后导入，
不用重新构建。不要仅将 .tar.gz 重命名为 .tar，也不要继续解包 .tar 中的镜像文件。

## ARM64 服务器导入运行

将解压得到的上述两个文件和 compose.yaml 复制到 ARM64 服务器的同一目录。
安装带 Compose 插件的 Docker，然后执行：

```sh
# 可选：检查文件传输是否完整。
sha256sum -c pvlane-arm64.tar.sha256

# 从未压缩的 TAR 镜像归档导入。
docker load -i pvlane-arm64.tar

# 使用已导入的本地镜像启动，不访问镜像仓库。
docker compose up -d --pull never
```

不使用 Compose 也可以运行；下面的命令与 Compose 二选一：

```sh
docker run -d --name pvlane --pull=never --restart unless-stopped -p 8080:80 pvlane:arm64
```

访问 http://服务器IP:8080 即可使用页面、下载项目 JSON 和 HTML 报告。
本配置已加入 UUID 兼容实现，使用 getRandomValues 生成 UUID v4，不依赖 Math.random。

局域网 HTTP 下不提供 showSaveFilePicker，因此点击保存会发起普通浏览器下载。
保存目录由浏览器下载设置决定；如需每次选择位置，可在浏览器设置中打开“下载前询问
每个文件的保存位置”。文件保存到操作浏览器的电脑，不会自动保存到飞牛设备上。
HTML 报告下载后可打开，并通过“打印 / 保存为 PDF”生成 PDF。

普通下载无法由网页确认是否真正保存成功，界面只提示“已发起下载”，请在浏览器下载
记录中确认。在“新建项目”对话框中，HTTP 下载完成后不会自动清空当前项目；确认文件
下载完成，再点击“不保存，新建”。

HTTPS 下如浏览器支持 showSaveFilePicker，仍沿用原来的选择位置并写入文件流程；取消
选择或写入失败不会额外发起下载。Electron 桌面版继续使用原有保存接口。
如需 HTTPS，可在前置反向代理上配置受浏览器信任的证书，并代理到容器的 80 端口。
本示例的 Nginx 配置本身不包含 HTTPS 证书和 TLS 监听。

本项目使用 /pdfjs/... 绝对路径，请先部署在域名根路径；
如需 /pvlane/ 子路径，需要额外调整 Vite base 和源码内的资源路径。

项目无后端、无数据库；项目文件通过浏览器保存在使用者本机，不需要为项目 JSON
挂载服务器数据卷。3D/WebGL 在使用者的浏览器中执行，服务器不需要 GPU。

## 更新版本

下载新一轮构建的 Artifact，解压并复制到服务器，检查校验和后执行：

```sh
docker load -i pvlane-arm64.tar
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

不要在 .dockerignore 中排除 test-fixtures。当前 tsconfig.json 会检查 src 下的测试文件，
其中 location-shadow.test.ts 引用了 test-fixtures/solar-spa-reference.json；该文件必须进入
构建上下文。最终 Nginx 镜像只复制 dist，因此保留测试数据不会将其作为源码带入运行镜像。

工作流使用 type=docker 导出可被 docker load 导入的单平台镜像归档。
如需同时提供 x86 镜像，应按平台分别构建、导出不同文件；不要直接在当前导出配置中
把 platforms 改为 linux/amd64,linux/arm64。

## 验证

```sh
docker image inspect pvlane:arm64 --format '{{.Os}}/{{.Architecture}}'
docker compose ps
docker compose logs --tail=50
```

镜像架构输出应为 linux/arm64。通过 HTTP 在 Chrome/Edge 检查页面、3D、PDF 底图导入、
项目下载、重新打开下载的项目以及报告下载。项目 JSON 应保存到浏览器使用者本机。

已使用失败构建对应的提交 9ca853e0f4dfa8c0f585dbeae2275bfd4085a549，
在本地 Windows / Node.js 24 环境执行 npm ci 和 npm run build，TypeScript 检查与
Vite 生产构建均通过。当前环境没有 Docker，尚未验证完整镜像构建或新的 GitHub Actions 运行。

加入 UUID 兼容实现后，已再次通过 npm run build，并在模拟的 HTTP 环境中检查
10000 个 UUID 的格式、唯一性、版本位和变体位，以及保留原生实现的行为。
尚未在用户的飞牛设备上实测。

加入项目和报告的 HTTP 下载方式后，已通过 18 项相关测试，覆盖完整 JSON/HTML 内容、
文件名处理、下载失败、原生选择器取消与错误、桌面版保存。npm run build 也已通过。
