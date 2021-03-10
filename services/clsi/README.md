overleaf/clsi
===============

A web api for compiling LaTeX documents in the cloud

The Common LaTeX Service Interface (CLSI) provides a RESTful interface to traditional LaTeX tools (or, more generally, any command line tool for composing marked-up documents into a display format such as PDF or HTML). The CLSI listens on the following ports by default:

* TCP/3013 - the RESTful interface
* TCP/3048 - reports load information
* TCP/3049 - HTTP interface to control the CLSI service

These defaults can be modified in `config/settings.defaults.coffee`.

The provided `Dockerfile` builds a docker image which has the docker command line tools installed. The configuration in `docker-compose-config.yml` mounts the docker socket, in order that the CLSI container can talk to the docker host it is running in. This allows it to spin up `sibling containers` running an image with a TeX distribution installed to perform the actual compiles.

The CLSI can be configured through the following environment variables:

  * `DOCKER_RUNNER` - Set to true to use sibling containers
  * `SYNCTEX_BIN_HOST_PATH` - Path to SyncTeX binary
  * `COMPILES_HOST_DIR` - Working directory for LaTeX compiles
  * `SQLITE_PATH` - Path to SQLite database
  * `TEXLIVE_IMAGE` - The TEXLIVE docker image to use for sibling containers, e.g. `gcr.io/overleaf-ops/texlive-full:2017.1`
  * `TEXLIVE_IMAGE_USER` - When using sibling containers, the user to run as in the TEXLIVE image. Defaults to `tex`
  * `TEX_LIVE_IMAGE_NAME_OVERRIDE` - The name of the registry for the docker image e.g. `gcr.io/overleaf-ops`
  * `FILESTORE_DOMAIN_OVERRIDE` - The url for the filestore service e.g.`http://$FILESTORE_HOST:3009`
  * `STATSD_HOST` - The address of the Statsd service (used by the metrics module)
  * `LISTEN_ADDRESS` - The address for the RESTful service to listen on. Set to `0.0.0.0` to listen on all network interfaces
  * `SMOKE_TEST` - Whether to run smoke tests

Installation
------------

The CLSI can be installed and set up as part of the entire [Overleaf stack](https://github.com/overleaf/overleaf) (complete with front end editor and document storage), or it can be run as a standalone service. To run is as a standalone service, first checkout this repository:

    $ git clone git@github.com:overleaf/clsi.git

Then install the require npm modules:

    $ npm install

Then build the Docker image:

    $ docker build . -t overleaf/clsi

Then pull the TeXLive image:

    $ docker pull texlive/texlive

Then start the Docker container:

    $ docker run --rm \
        -p 127.0.0.1:3013:3013 \
        -e LISTEN_ADDRESS=0.0.0.0 \
        -e DOCKER_RUNNER=true \
        -e TEXLIVE_IMAGE=texlive/texlive \
        -e TEXLIVE_IMAGE_USER=root \
        -e COMPILES_HOST_DIR="$PWD/compiles" \
        -v "$PWD/compiles:/app/compiles" \
        -v "$PWD/cache:/app/cache" \
        -v /var/run/docker.sock:/var/run/docker.sock \
        overleaf/clsi

Note: if you're running the CLSI in macOS you may need to use `-v /var/run/docker.sock.raw:/var/run/docker.sock` instead.

The CLSI should then be running at <http://localhost:3013>

Config
------

The CLSI will use a SQLite database by default, but you can optionally set up a MySQL database and then fill in the database name, username and password in the config file at `config/settings.development.coffee`.

API
---

The CLSI is based on a JSON API.

#### Example Request

(Note that valid JSON should not contain any comments like the example below).

    POST /project/<project-id>/compile

```json5
{
    "compile": {
        "options": {
            // Which compiler to use. Can be latex, pdflatex, xelatex or lualatex
            "compiler": "lualatex",
            // How many seconds to wait before killing the process. Default is 60.
            "timeout": 40
        },
        // The main file to run LaTeX on
        "rootResourcePath": "main.tex",
        // An array of files to include in the compilation. May have either the content
        // passed directly, or a URL where it can be downloaded.
        "resources": [
          {
            "path": "main.tex",
            "content": "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}"
          }
          // ,{
          //     "path": "image.png",
          //     "url": "www.example.com/image.png",
          //     "modified": 123456789 // Unix time since epoch
          // }
        ]
    }
}
```

With `curl`, if you place the above JSON in a file called `data.json`, the request would look like this:

``` shell
$ curl -X POST -H 'Content-Type: application/json' -d @data.json http://localhost:3013/project/<id>/compile
```

You can specify any project-id in the URL, and the files and LaTeX environment will be persisted between requests.
URLs will be downloaded and cached until provided with a more recent modified date.

#### Example Response

```json
{
    "compile": {
        "status": "success",
        "outputFiles": [{
            "type": "pdf",
            "url": "http://localhost:3013/project/<project-id>/output/output.pdf"
        }, {
            "type": "log",
            "url": "http://localhost:3013/project/<project-id>/output/output.log"
        }]
    }
}
```

License
-------

The code in this repository is released under the GNU AFFERO GENERAL PUBLIC LICENSE, version 3. A copy can be found in the `LICENSE` file.

Copyright (c) Overleaf, 2014-2021.
