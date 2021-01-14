FROM sharelatex/sharelatex:2.5.0

# Patch #826: Fixes log path for contacts service to be picked up by logrotate
COPY contacts-run.patch /etc/service/contacts-sharelatex
RUN cd /etc/service/contacts-sharelatex && patch < contacts-run.patch

# Patch #826: delete old logs for the contacts service
COPY delete-old-logs.patch /etc/my_init.d
RUN cd /etc/my_init.d && patch < delete-old-logs.patch \
&&  chmod +x /etc/my_init.d/10_delete_old_logs.sh

# Patch #827: fix logrotate file permissions
RUN chmod 644 /etc/logrotate.d/sharelatex
