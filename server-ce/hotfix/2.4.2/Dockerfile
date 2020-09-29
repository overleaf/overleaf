FROM sharelatex/sharelatex:2.4.1


# Patch: Fixes anonymous read/write sharing
ADD anonymous-metadata-router.patch /var/www/sharelatex/web/app/src/anonymous-metadata-router.patch
RUN cd /var/www/sharelatex/web/app/src && \
    patch < anonymous-metadata-router.patch
ADD anonymous-metadata-contacts.patch /var/www/sharelatex/web/app/src/Features/Contacts/anonymous-metadata-contacts.patch
RUN cd /var/www/sharelatex/web/app/src/Features/Contacts && \
    patch < anonymous-metadata-contacts.patch
