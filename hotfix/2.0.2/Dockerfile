FROM sharelatex/sharelatex:2.0.1


# Patch 1: Fixes anonymous link sharing
ADD 1-anon-upload.patch /var/www/sharelatex/web/app/src/Features/Uploads/1-anon-upload.patch
RUN cd /var/www/sharelatex/web/app/src/Features/Uploads/ && \
    patch < 1-anon-upload.patch


# Patch 2: Fixes read-only access
ADD 2-read-only-access.patch /var/www/sharelatex/web/app/src/Features/TokenAccess/3-read-only-access.patch
RUN cd /var/www/sharelatex/web/app/src/Features/TokenAccess/ && \
    patch < 3-read-only-access.patch


# Patch 3: Fixes url linking
ADD 3-url-linking-1.patch /var/www/sharelatex/web/app/src/infrastructure/6-url-linking-1.patch
RUN cd /var/www/sharelatex/web/app/src/infrastructure/ && \
    patch < 6-url-linking-1.patch
ADD 4-url-linking-2.patch /var/www/sharelatex/web/app/views/project/editor/7-url-linking-2.patch
RUN cd /var/www/sharelatex/web/app/views/project/editor/ && \
    patch < 7-url-linking-2.patch


# Patch 4: Disables analytics
ADD 5-disable-analytics-1.patch /var/www/sharelatex/web/app/src/Features/Analytics/8-disable-analytics-1.patch
RUN cd /var/www/sharelatex/web/app/src/Features/Analytics/ && \
    patch < 8-disable-analytics-1.patch
ADD 6-disable-analytics-2.patch /var/www/sharelatex/web/app/src/infrastructure/9-disable-analytics-2.patch
RUN cd /var/www/sharelatex/web/app/src/infrastructure/ && \
    patch < 9-disable-analytics-2.patch
