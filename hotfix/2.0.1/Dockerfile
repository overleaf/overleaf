FROM sharelatex/sharelatex:2.0.0


# Patch 1: Fixes project deletion (https://github.com/overleaf/overleaf/issues/644)
ADD disable_project_history.patch /etc/sharelatex/disable_project_history.patch
RUN cd /etc/sharelatex && \
    patch < disable_project_history.patch


# Patch 2: Fixes admin creation via CLI (https://github.com/overleaf/overleaf/issues/647)
ADD create_and_destroy_users.patch /var/www/sharelatex/tasks/create_and_destroy_users.patch
RUN cd /var/www/sharelatex/tasks/ && \
    patch < create_and_destroy_users.patch
