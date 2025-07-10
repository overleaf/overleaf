FROM debian:testing-slim

RUN apt-get update
RUN apt-cache depends texlive-full | grep "Depends: " | grep -v -- "-doc" | grep -v -- "-lang-" | sed 's/Depends: //' | xargs apt-get install -y --no-install-recommends
RUN apt-get install -y --no-install-recommends fontconfig inkscape pandoc python3-pygments curl xz-utils

# Typst
# TODO: support multiple versions of typst
RUN mkdir -p /opt/typst && \
    curl -LO https://github.com/typst/typst/releases/download/v0.13.1/typst-x86_64-unknown-linux-musl.tar.xz && \
    env -C /opt/typst tar --strip-components=1 -xf "$(realpath typst-*.tar.xz)" && \
    ln -s /opt/typst/typst /bin/typst && \
    rm -f typst-*.tar.xz

COPY typst-wrapper /usr/bin/typst-wrapper

RUN useradd tex
USER tex
