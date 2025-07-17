FROM debian:testing-slim

RUN apt-get update
RUN apt-cache depends texlive-full | grep "Depends: " | grep -v -- "-doc" | grep -v -- "-lang-" | sed 's/Depends: //' | xargs apt-get install -y --no-install-recommends
RUN apt-get install -y --no-install-recommends fontconfig inkscape pandoc python3-pygments curl xz-utils
# Install otf fonts for typst
RUN apt-get install -y --no-install-recommends fonts-texgyre fonts-texgyre-math

# Typst
COPY typst-wrapper /usr/bin/typst-wrapper

RUN useradd tex
USER tex
