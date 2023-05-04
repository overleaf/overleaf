FROM sharelatex/sharelatex:3.5.5

# Patch: support trustProxyIps in Server CE/Pro
COPY trusted_proxy_ips.patch .
RUN patch -p0 --directory=/etc/sharelatex < trusted_proxy_ips.patch

# Patch: add script to cleanup legacy history data
ADD clean_sl_history_data.js /overleaf/services/web/scripts/history/clean_sl_history_data.js
