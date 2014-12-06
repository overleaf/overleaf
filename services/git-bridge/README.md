writelatex-git-bridge
=====================

Required
--------
  * ant (for building)
  * jdk-7 (for compiling and running)

Building
--------
### Ubuntu ###
Run `/install.sh` to get dependencies, build, test, package, and make it a service.

Use `service wlgb start` and `service wlgb stop` to start and stop the server.

The configuration file will be at `/etc/wlgb/config.json`.
### Using ant ###
Run `ant all` to build, test, and package it into a jar at `bin/writelatex-git-bridge.jar`.

Use `java -jar <path_to_jar> <path_to_config_file> to run the server.

Runtime Configuration
---------------------

The configuration file is in `.json` format. There is an example at `bin/config.json`.

    {
        "port": the port number (int),
        "rootGitDirectory": the directory in which to store git repos and the db/atts (string),
        "apiKey": currently does nothing (string),
        "apiBaseUrl": base url for the snapshot api (string),
        "username": username for http basic auth (string, optional),
        "password": password for http basic auth (string, optional),
        "serviceName": current name of writeLaTeX in case it ever changes (string)
    }

You have to restart the server for configuration changes to take effect.
