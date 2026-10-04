# Official Ubuntu index, including separate amd64 and arm64 child manifests.
# Ubuntu 22.04 is the build baseline; this is not certification of every distro.
FROM ubuntu:22.04@sha256:5ec03bb3441e8b0bf3b4f9cd4629a1ae763010dc3035bb8da3ae6cf026486401
ARG TARGETARCH
ARG WITH_WINE=0
ARG NODE_VERSION=24.21.0
USER root
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl xz-utils git python3 build-essential pkg-config fakeroot \
    rpm dpkg-dev file procps util-linux tini squashfs-tools libopenjp2-tools \
    libfuse2 libnss3 libatk1.0-0 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libgbm1 libgtk-3-0 libasound2 libsecret-1-0 libnotify4 libxss1 libxtst6 \
    libx11-xcb1 libatspi2.0-0 libuuid1 xdg-utils xvfb dbus-x11 fonts-dejavu-core \
    && if [ "$WITH_WINE" = 1 ]; then test "$TARGETARCH" = amd64 && apt-get install -y --no-install-recommends wine64 wine; fi \
    && rm -rf /var/lib/apt/lists/*
COPY scripts/platform/extract-tar.py /usr/local/bin/ziaforge-extract-tar
RUN case "$TARGETARCH" in \
      amd64) node_arch=x64; node_sha=fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6 ;; \
      arm64) node_arch=arm64; node_sha=6ad1325edbdb5649c379b75a237147a666c95d4f9ae8d340fef2d1575d289ad2 ;; \
      *) exit 2 ;; esac \
    && test "$NODE_VERSION" = 24.21.0 \
    && curl --fail --location --retry 2 "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz \
    && echo "${node_sha}  /tmp/node.tar.xz" | sha256sum --check - \
    && python3 /usr/local/bin/ziaforge-extract-tar /tmp/node.tar.xz /usr/local 1 \
    && rm /tmp/node.tar.xz \
    && useradd --create-home --uid 1002 --shell /bin/bash ziaf \
    && mkdir -p /workspace /evidence && chown ziaf:ziaf /workspace /evidence
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8 WINEDEBUG=-all WINEDLLOVERRIDES="mscoree,mshtml="
USER ziaf
WORKDIR /workspace
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sleep", "infinity"]
