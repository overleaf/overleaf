# Overleaf-OU

## Prerequisite

## Setup

To run the development environment, navigate to the `develop` directory in `overleaf-ou` and execute the following commands:

```bash
bin/init
bin/dev
bin/dev webpack
bin/down
bin/up
```

If you encounter issues with page loading after starting the containers, try restarting them with:

```bash
bin/down
bin/up
```

Verify that the containers are running using `docker ps`. The output should list the active containers, though specific ports and container IDs may differ.

```
CONTAINER ID   IMAGE                      COMMAND                  CREATED        STATUS         PORTS                        NAMES
e22a9b88d79b   develop-webpack            "docker-entrypoint.s…"   12 hours ago   Up 7 seconds   127.0.0.1:80->3808/tcp       develop-webpack-1
0d16db7d27d5   develop-web                "docker-entrypoint.s…"   39 hours ago   Up 4 seconds                                develop-web-1
116d242d2803   develop-filestore          "docker-entrypoint.s…"   39 hours ago   Up 7 seconds                                develop-filestore-1
04f3ce9abad9   develop-docstore           "docker-entrypoint.s…"   39 hours ago   Up 7 seconds                                develop-docstore-1
cf8bd754ff84   develop-history-v1         "docker-entrypoint.s…"   39 hours ago   Up 7 seconds                                develop-history-v1-1
ec922310aa1f   develop-document-updater   "docker-entrypoint.s…"   39 hours ago   Up 7 seconds                                develop-document-updater-1
72f535befc07   develop-project-history    "docker-entrypoint.s…"   39 hours ago   Up 7 seconds                                develop-project-history-1
032148a1613a   develop-notifications      "docker-entrypoint.s…"   39 hours ago   Up 7 seconds                                develop-notifications-1
70c2492fb5e8   develop-clsi               "/bin/sh /entrypoint…"   39 hours ago   Up 7 seconds                                develop-clsi-1
d1694dffb4c7   develop-real-time          "docker-entrypoint.s…"   39 hours ago   Up 7 seconds                                develop-real-time-1
466e115d80a7   develop-contacts           "docker-entrypoint.s…"   39 hours ago   Up 7 seconds                                develop-contacts-1
a3bbce697684   develop-chat               "docker-entrypoint.s…"   39 hours ago   Up 7 seconds                                develop-chat-1
cf9ec08831c6   mongo:6.0                  "docker-entrypoint.s…"   39 hours ago   Up 6 seconds   127.0.0.1:27017->27017/tcp   develop-mongo-1
c6bf55f625cd   redis:5                    "docker-entrypoint.s…"   39 hours ago   Up 7 seconds   127.0.0.1:6379->6379/tcp     develop-redis-1
```

Notably, running `bin/dev webpack` enables hot-reloading for front-end development. This allows changes in the repository to be detected automatically, updating the relevant containers without requiring a full rebuild. This significantly speeds up development.

## Developer Notes

Check the `./dev-notes/` directory for notes related to the features we are developing.
These notes include useful findings and serve as place to share progress between group members.

## Feature Requests / Tickets

- Install the Overleaf Repository Toolkit
- Complete the Quick Start Guide from the Overleaf Toolkit
- Feature Request: User Mentions in Comments
- Feature Request: One-Click Text Color and Highlight Button
- Feature Request: Export PDF with Comments (Optional Challenge)
- Feature Request: Owners Can Lock Documents to Prevent Edits
- Feature Request: Improve Copy Files and Folders GUI
- MENTOR REQUEST: Resolve User-Lookup Issues
- MENTOR REQUEST: CI/CD Pipeline Setup (Lower Priority)
- Simplified Documentation for Setup for Development
