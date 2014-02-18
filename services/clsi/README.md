clsi-sharelatex
===============

A web api for compiling LaTeX documents in the cloud

Installation
------------

The CLSI can be installed and set up as part of the entire [ShareLaTeX stack](https://github.com/sharelatex/sharelatex) (complete with front end editor and document storage), or it can be run as a standalone service. To run is as a standalone service, first checkout this repository:

    $ git clone git@github.com:sharelatex/clsi-sharelatex.git
    
Then install the require npm modules:

    $ npm install
    
Then compile the coffee script source files:

    $ grunt compile
    
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

```javascript
    {
      "options": {
          "compiler": "lualatex" # Can be latex, pdflatex, xelatex or lualatex
          "timeout": 40 # How many seconds to wait before killing the process. Default is 60.
      },
      "rootResourcePath": "main.tex", # The main file to run LaTeX on
      # An array of files to include in the compilation
      "resources": [{
        "path": "main.tex",
        "content": "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}"
      }]
    }
```
