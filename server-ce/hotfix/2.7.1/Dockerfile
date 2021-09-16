FROM sharelatex/sharelatex:2.7.0

# Patch: fixes overleaf.com onboarding email being sent in CE/SP
COPY remove-disconnect-endpoint.patch .
RUN patch -p0 < remove-disconnect-endpoint.patch
