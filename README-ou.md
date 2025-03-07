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
