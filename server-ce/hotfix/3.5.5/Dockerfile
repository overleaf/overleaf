FROM sharelatex/sharelatex:3.5.4

# Patch: fix shutdown sequence: flush document-updater before history services.
RUN cd /etc/my_init.pre_shutdown.d \
&&  mv 02_flush_document_updater 01_flush_document_updater \
&&  mv 01_flush_project_history 02_flush_project_history \
&&  mv 01_flush_track_changes 02_flush_track_changes
