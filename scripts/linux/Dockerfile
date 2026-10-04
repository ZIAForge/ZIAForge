# Ubuntu 24.04 amd64 from Docker Official Images. Override BASE_IMAGE only after
# inspecting and recording the exact immutable digest of a cached Ubuntu image.
ARG BASE_IMAGE=ubuntu:24.04@sha256:f610ab94648195aa356059f5b41d6085c9d4d903c072430cdd1af7bdb646106b
FROM ${BASE_IMAGE}
USER root
ARG NODE_VERSION=24.21.0
ARG NODE_SHA256=fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl xz-utils git build-essential python3 pkg-config fakeroot \
    dpkg-dev file procps util-linux tini xvfb fluxbox dbus-x11 x11-utils xdotool \
    fonts-dejavu-core libnss3 libatk1.0-0 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libgbm1 libgtk-3-0 libasound2t64 libsecret-1-0 libnotify4 libxss1 libxtst6 \
    libx11-xcb1 libatspi2.0-0 libuuid1 xdg-utils desktop-file-utils \
    && rm -rf /var/lib/apt/lists/* \
    && curl --fail --location --retry 2 "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node.tar.xz \
    && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum --check - \
    && tar -xJf /tmp/node.tar.xz --strip-components=1 -C /usr/local \
    && rm /tmp/node.tar.xz \
    && useradd --create-home --uid 1002 --shell /bin/bash ziaf \
    && mkdir -p /workspace /evidence && chown ziaf:ziaf /workspace /evidence
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8 DISPLAY=:99
WORKDIR /workspace
# Secret Service is separate from libsecret; the fixture unlocks a disposable
# keyring over its private DBus session without putting passwords in argv.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    gnome-keyring libsecret-tools && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /evidence/runtime /home/ziaf/.local/share /home/ziaf/.config \
    && chown -R ziaf:ziaf /evidence/runtime /home/ziaf/.local /home/ziaf/.config \
    && chmod 0700 /evidence/runtime
ENV XDG_RUNTIME_DIR=/evidence/runtime XDG_DATA_HOME=/home/ziaf/.local/share XDG_CONFIG_HOME=/home/ziaf/.config
USER ziaf
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sleep", "infinity"]
