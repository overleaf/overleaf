overleaf/clsi
===============

A web api for compiling LaTeX documents in the cloud

The Common LaTeX Service Interface (CLSI) provides a RESTful interface to traditional LaTeX tools (or, more generally, any command line tool for composing marked-up documents into a display format such as PDF or HTML). The CLSI listens on the following ports by default:

* TCP/3013 - the RESTful interface
* TCP/3048 - reports load information
* TCP/3049 - HTTP interface to control the CLSI service

These defaults can be modified in `config/settings.defaults.js`.

The provided `Dockerfile` builds a Docker image which has the Docker command line tools installed. The configuration in `docker-compose-config.yml` mounts the Docker socket, in order that the CLSI container can talk to the Docker host it is running in. This allows it to spin up `sibling containers` running an image with a TeX distribution installed to perform the actual compiles.

The CLSI can be configured through the following environment variables:

* `ALLOWED_COMPILE_GROUPS` - Space separated list of allowed compile groups
* `ALLOWED_IMAGES` - Space separated list of allowed Docker TeX Live images 
* `CATCH_ERRORS` - Set to `true` to log uncaught exceptions
* `COMPILE_GROUP_DOCKER_CONFIGS` - JSON string of Docker configs for compile groups
* `COMPILES_HOST_DIR` - Working directory for LaTeX compiles
* `COMPILE_SIZE_LIMIT` - Sets the body-parser [limit](https://github.com/expressjs/body-parser#limit)
* `DOCKER_RUNNER` - Set to true to use sibling containers
* `DOCKER_RUNTIME` - 
* `FILESTORE_DOMAIN_OVERRIDE` - The url for the filestore service e.g.`http://$FILESTORE_HOST:3009`
* `FILESTORE_PARALLEL_FILE_DOWNLOADS` - Number of parallel file downloads
* `FILESTORE_PARALLEL_SQL_QUERY_LIMIT` - Number of parallel SQL queries
* `LISTEN_ADDRESS` - The address for the RESTful service to listen on. Set to `0.0.0.0` to listen on all network interfaces
* `PROCESS_LIFE_SPAN_LIMIT_MS` - Process life span limit in milliseconds
* `SENTRY_DSN` - Sentry [Data Source Name](https://docs.sentry.io/product/sentry-basics/dsn-explainer/)
* `SMOKE_TEST` - Whether to run smoke tests
* `SQLITE_PATH` - Path to SQLite database
* `SYNCTEX_BIN_HOST_PATH` - Path to SyncTeX binary
* `TEXLIVE_IMAGE` - The TeX Live Docker image to use for sibling containers, e.g. `gcr.io/overleaf-ops/texlive-full:2017.1`
* `TEX_LIVE_IMAGE_NAME_OVERRIDE` - The name of the registry for the Docker image e.g. `gcr.io/overleaf-ops`
* `TEXLIVE_IMAGE_USER` - When using sibling containers, the user to run as in the TeX Live image. Defaults to `tex`
* `TEXLIVE_OPENOUT_ANY` - Sets the `openout_any` environment variable for TeX Live (see the `\openout` primitive [documentation](http://tug.org/texinfohtml/web2c.html#tex-invocation))

Further environment variables configure the [metrics module](https://github.com/overleaf/metrics-module)

Installation
------------

The CLSI can be installed and set up as part of the entire [Overleaf stack](https://github.com/overleaf/overleaf) (complete with front end editor and document storage), or it can be run as a standalone service. To run is as a standalone service, first checkout this repository:

    $ git clone git@github.com:overleaf/clsi.git

Then build the Docker image:

    $ docker build . -t overleaf/clsi

Then pull the TeX Live image:

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

The CLSI will use a SQLite database by default, but you can optionally set up a MySQL database and then fill in the database name, username and password in the config file at `config/settings.development.js`.

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
