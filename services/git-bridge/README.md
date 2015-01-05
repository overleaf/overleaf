writelatex-git-bridge
=====================

Required
--------
  * `ant` (for building)
  * `jdk-7` (for compiling and running)

Installation
------------
### Ubuntu ###
Run `install.sh` to get dependencies, build, test, package, and make it a service.

Use `service wlgb start` and `service wlgb stop` to start and stop the server.

The configuration file will be at `/etc/wlgb/config.json`.

Run `uninstall.sh` to undo what `install.sh` did.
### Manually ###
Run `ant all` to build, test, and package it into a jar at `bin/writelatex-git-bridge.jar`.

Use `java -jar <path_to_jar> <path_to_config_file>` to run the server.

Runtime Configuration
---------------------

The configuration file is in `.json` format. There is an example at `bin/config.json`.

    {
        "port" (int): the port number,
        "rootGitDirectory" (string): the directory in which to store git repos and the db/atts,
        "apiBaseUrl" (string): base url for the snapshot api,
        "username" (string, optional): username for http basic auth,
        "password" (string, optional): password for http basic auth,
        "serviceName" (string): current name of writeLaTeX in case it ever changes,
        "hostname": (string): the public hostname of the server, for postback,
        "ssl": { (object): ssl configuration
            "enabled": (boolean): decides on http or https for the postback url
        }
    }

You have to restart the server for configuration changes to take effect.
