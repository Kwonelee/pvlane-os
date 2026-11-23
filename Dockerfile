# syntax=docker/dockerfile:1
# Static assets can be built on the runner's native architecture.
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Runs prebuild too, including scripts/prepare-pdf.mjs.
RUN npm run build

# BuildKit selects the ARM64 variant for --platform=linux/arm64.
FROM nginx:stable-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
# Preserve the project's license and third-party notices in the image.
COPY LICENSE*.md THIRD-PARTY-NOTICES.md /usr/share/licenses/pvlane/
COPY docs/font-licenses/ /usr/share/licenses/pvlane/fonts/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
