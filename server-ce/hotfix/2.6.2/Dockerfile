FROM sharelatex/sharelatex:2.6.1

# Patch: fixes overleaf.com onboarding email being sent in CE/SP
COPY onboarding-email.patch ${baseDir}
RUN cd ${baseDir} && patch -p0 < onboarding-email.patch
