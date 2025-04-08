# writelatex-git-bridge

## Docker

The `Dockerfile` contains all the requirements for building and running the
 writelatex-git-bridge.

```bash
# build the image
docker build -t writelatex-git-bridge .

# run it with the demo config
docker run -v `pwd`/conf/local.json:/conf/runtime.json writelatex-git-bridge
```

## Native install

### Required packages

  * `maven` (for building, running tests and packaging)
  * `jdk-8` (for compiling and running)

### Commands

To be run from the base directory:

**Build jar**:
`mvn package`

**Run tests**:
`mvn test`

**Clean**:
`mvn clean`

To be run from the dev-environment:

**Build jar**:
`bin/run git-bridge make package`

**Run tests**:
`bin/run git-bridge make test`

**Clean**:
`bin/run git-bridge make clean`

### Installation

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

## Runtime Configuration

The configuration file is in `.json` format.

    {
        "port" (int): the port number,
        "rootGitDirectory" (string): the directory in which to store
                                     git repos and the db/atts,
        "apiBaseUrl" (string): base url for the snapshot api,
        "username" (string, optional): username for http basic auth,
        "password" (string, optional): password for http basic auth,
        "postbackBaseUrl" (string): the postback url,
        "serviceName" (string): current name of writeLaTeX
                                in case it ever changes,
        "oauth2Server" (string): oauth2 server,
                                 with protocol and
                                 without trailing slash,
                                 null or missing if oauth2 shouldn't be used
        },
        "repoStore" (object, optional): { configure the repo store
            "maxFileSize" (long, optional): maximum size of a file, inclusive
        },
        "swapStore" (object, optional): { the place to swap projects to.
                                          if null, type defaults to
                                          "noop"
            "type" (string): "s3", "memory", "noop" (not recommended),
            "awsAccessKey" (string, optional): only for s3,
            "awsSecret" (string, optional): only for s3,
            "s3BucketName" (string, optional): only for s3
        },
        "swapJob" (object, optional): { configure the project
                                        swapping job.
                                        if null, defaults to no-op
            "minProjects" (int64): lower bound on number of projects
                                   present. The swap job will never go
                                   below this, regardless of what the
                                   watermark shows. Regardless, if
                                   minProjects prevents an eviction,
                                   the swap job will WARN,
            "lowGiB" (int32): the low watermark for swapping,
                              i.e. swap until disk usage is below this,
            "highGiB" (int32): the high watermark for swapping,
                               i.e. start swapping when
                               disk usage becomes this,
            "intervalMillis" (int64): amount of time in between running
                                      swap job and checking watermarks.
                                      3600000 is 1 hour
        }
    }

You have to restart the server for configuration changes to take effect.


## Creating OAuth app

In dev-env, run the following command in mongo to create the oauth application
for git-bridge.

```
db.oauthApplications.insert({
  "clientSecret" : "v1.G5HHTXfxsJMmfFhSar9QhJLg/u4KpGpYOdPGwoKdZXk=",
  "grants" : [
    "password"
  ],
  "id" : "264c723c925c13590880751f861f13084934030c13b4452901e73bdfab226edc",
  "name" : "Overleaf Git Bridge",
  "redirectUris" : [],
  "scopes" : [
    "git_bridge"
  ]
})
```
