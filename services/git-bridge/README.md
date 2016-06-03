writelatex-git-bridge
=====================

Required
--------
  * `maven` (for building)
  * `jdk-8` (for compiling and running)

Installation
------------

Install dependencies:

```
sudo apt-get update
sudo apt-get install -y maven
sudo apt-get install -y openjdk-8-jdk
sudo update-alternatives --set java /usr/lib/jvm/java-8-openjdk-amd64/jre/bin/java
sudo update-alternatives --set javac /usr/lib/jvm/java-8-openjdk-amd64/jre/bin/javac
```

Create a config file according to the format below.

Run `mvn package` to build, test, and package it into a jar at `target/writelatex-git-bridge-1.0-SNAPSHOT-jar-with-dependencies.jar`.

Use `java -jar <path_to_jar> <path_to_config_file>` to run the server.

Runtime Configuration
---------------------

The configuration file is in `.json` format.

    {
        "port" (int): the port number,
        "rootGitDirectory" (string): the directory in which to store git repos and the db/atts,
        "apiBaseUrl" (string): base url for the snapshot api,
        "username" (string, optional): username for http basic auth,
        "password" (string, optional): password for http basic auth,
        "postbackBaseUrl" (string): the postback url,
        "serviceName" (string): current name of writeLaTeX in case it ever changes
        "oauth2" (object): { /* null or missing if oauth2 shouldn't be used */
            "oauth2ClientID" (string): oauth2 client ID
            "oauth2ClientSecret" (string): oauth2 client secret
            "oauth2Server" (string): oauth2 server, with protocol and without trailing slash
        }
    }

You have to restart the server for configuration changes to take effect.
