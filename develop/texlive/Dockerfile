FROM debian:testing-slim

RUN apt-get update
RUN apt-cache depends texlive-full | grep "Depends: " | grep -v -- "-doc" | grep -v -- "-lang-" | sed 's/Depends: //' | xargs apt-get install -y --no-install-recommends
RUN apt-get install -y --no-install-recommends fontconfig inkscape pandoc python3-pygments

RUN useradd tex
USER tex
