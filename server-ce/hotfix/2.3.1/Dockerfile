FROM sharelatex/sharelatex:2.3.0


# Patch: Fixes NPE when invoking synctex (https://github.com/overleaf/overleaf/issues/756)
ADD check-clsi-setting-exists.patch /var/www/sharelatex/clsi/app/js/check-clsi-setting-exists.patch
RUN cd /var/www/sharelatex/clsi/app/js && \
    patch < check-clsi-setting-exists.patch
