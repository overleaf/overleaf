clsi-sharelatex
===============

A web api for compiling LaTeX documents in the cloud

[![Build Status](https://travis-ci.org/sharelatex/clsi-sharelatex.png?branch=master)](https://travis-ci.org/sharelatex/clsi-sharelatex)

Installation
------------

The CLSI can be installed and set up as part of the entire [ShareLaTeX stack](https://github.com/sharelatex/sharelatex) (complete with front end editor and document storage), or it can be run as a standalone service. To run is as a standalone service, first checkout this repository:

    $ git clone git@github.com:sharelatex/clsi-sharelatex.git
    
Then install the require npm modules:

    $ npm install
    
Then compile the coffee script source files:

    $ grunt install
    
Finally, (after configuring your local database - see the Config section), run the CLSI service:

    $ grunt run
    
The CLSI should then be running at http://localhost:3013.
    
Config
------

You will need to set up a database in mysql to use with the CLSI, and then fill in the database name, username and password in the config file at `config/settings.development.coffee`.

API
---

The CLSI is based on a JSON API.

#### Example Request

(Note that valid JSON should not contain any comments like the example below).

    POST /project/<project-id>/compile

```javascript
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
        "resources": [{
            "path": "main.tex",
            "content": "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}"
        }, {
            "path": "image.png",
            "url": "www.example.com/image.png",
            "modified": 123456789 // Unix time since epoch
        }]
    }
}
```

You can specify any project-id in the URL, and the files and LaTeX environment will be persisted between requests.
URLs will be downloaded and cached until provided with a more recent modified date.

#### Example Response

```javascript
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

Copyright (c) ShareLaTeX, 2014.
