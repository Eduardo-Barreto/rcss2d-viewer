# rcssserver built from the official release tarball, with the server as the entrypoint, for
# `just live-smoke`. Build it with `just rcssserver-image`.
FROM ubuntu:24.04 AS build
ARG VERSION=19.0.0
ARG SHA256=08abeef0bf94816a9886647fd578da0dc58d40b08bb6a27ed85cddc2acce2aea
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential flex bison libboost-dev \
        libboost-system-dev libfl-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:${SHA256} \
    https://github.com/rcsoccersim/rcssserver/releases/download/rcssserver-${VERSION}/rcssserver-${VERSION}.tar.gz \
    /src/rcssserver.tar.gz
WORKDIR /src
RUN tar xzf rcssserver.tar.gz --strip-components=1 \
    && ./configure --prefix=/opt/rcssserver \
    && make -j"$(nproc)" \
    && make install-strip

FROM ubuntu:24.04
RUN apt-get update \
    && apt-get install -y --no-install-recommends libboost-system1.83.0 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/rcssserver /opt/rcssserver
ENV LD_LIBRARY_PATH=/opt/rcssserver/lib
USER ubuntu
ENTRYPOINT ["/opt/rcssserver/bin/rcssserver"]
