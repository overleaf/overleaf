FROM sharelatex/sharelatex:2.5.1

# Patch: fixes registration token creation
COPY create-token-lowercase-email.patch ${baseDir}
RUN cd ${baseDir} && patch -p0 < create-token-lowercase-email.patch

# Migration for tokens with invalid email addresses
ADD 12_update_token_email.js /var/www/sharelatex/migrations/12_update_token_email.js
