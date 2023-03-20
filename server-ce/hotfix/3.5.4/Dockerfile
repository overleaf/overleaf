FROM sharelatex/sharelatex:3.5.3

# Patch: run primary email check in saas only
COPY primary_email_check_saas.patch .
RUN patch -p0 < primary_email_check_saas.patch
