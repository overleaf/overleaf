FROM sharelatex/sharelatex:4.1.5

# Adds missing dependency patches
ADD patches /overleaf/patches
RUN npm run postinstall
