ShareLaTeX
==========

[ShareLaTeX](https://www.sharelatex.com) is now open source! ShareLaTeX is an online real-time collaborative LaTeX editor, and you can now run your own local version where you can host, edit, collaborate in real-time, and compile your LaTeX documents. We’re still 100% focused on running the hosted version at http://www.sharelatex.com, but we want to be more flexible in how you can use ShareLaTeX, and give something back to our wonderful community.

**[Read more on our blog](https://www.sharelatex.com/blog/2014/02/21/sharelatex-is-now-open-source.html#.UwcnsEJ_ugc)**

Installation
------------

ShareLaTeX uses a service oriented architecture (SOA) where we have lots of small
APIs that talk to each other over HTTP and Redis pub-sub channels. This repository
pulls together all of the different services and allows you to set up and run
them quickly.

First, check out a local copy of this repository:

```bash
git clone https://github.com/sharelatex/sharelatex.git
cd sharelatex
```

Next install all the node modules and ShareLaTeX services:

```bash
npm install
grunt install
```

This will create a config file in `config/settings.development.coffee`. You should open
this now and configure your AWS S3 credentials, and other custom settings.

Now check that your system is set up correctly to run ShareLaTeX (checks that you have
the required dependencies installed.) Watch out for any failures.

```bash
grunt check --force
```

When that has finished, run ShareLaTeX with

```bash
grunt run
```

ShareLaTeX should now be running at http://localhost:3000.

Dependencies
------------

ShareLaTeX should run on OS X and Linux. You need:

* [Node.js](http://nodejs.org/) 0.10 or greater
* The [grunt](http://gruntjs.com/) command line tools (Run `npm install -g grunt-cli` to install them)
* A local instance of [Redis](http://redis.io/) (version 2.6 or later) and [MongoDB](http://www.mongodb.org/) running on their standard ports.
* An up to date version of [TeXLive](https://www.tug.org/texlive/), with the `latexmk` program installed. You need latexmk from TeXLive 2013 (or the later). If you're on an older version, or aren't sure, then the following commands will install the latest version locally:

```bash
mkdir ~/bin 
curl http://mirror.physik-pool.tu-berlin.de/tex-archive/support/latexmk/latexmk.pl > ~/bin/latexmk
chmod a+x ~/bin/latexmk
export PATH=~/bin:$PATH
```

Config
------

ShareLaTeX should mostly run out of the box, although it uses Amazon S3 for storing binary
files like images. You will need to configure ShareLaTeX to use your own S3 access key
which can be done by editing the file at `config/settings.development.coffee`

A local settings file can be specified by setting the `SHARELATEX_CONFIG` environment variable
to point to your own settings file. E.g.

```bash
export SHARELATEX_CONFIG=/home/james/config/settings.development.coffee
```

Other repositories
------------------

ShareLaTeX consists of many separate services, each with their own Node.js process
and source code repository. These are all downloaded and set upwhen you run
`grunt install`

The different services are:

### [web](https://github.com/sharelatex/web-sharelatex) [![Build Status](https://travis-ci.org/sharelatex/web-sharelatex.png?branch=master)](https://travis-ci.org/sharelatex/web-sharelatex)

The front facing web server that serves all the HTML pages, CSS and JavaScript
to the client. Also contains a lot of logic around creating and editing
projects, and account management.

### [document-updater](https://github.com/sharelatex/document-updater-sharelatex) [![Build Status](https://travis-ci.org/sharelatex/document-updater-sharelatex.png?branch=master)](https://travis-ci.org/sharelatex/document-updater-sharelatex)

Processes updates that come in from the editor when users modify documents. Ensures that
the updates are applied in the right order, and that only one operation is modifying
the document at a time. Also caches the documents in redis for very fast but persistent
modifications.

### [CLSI](https://github.com/sharelatex/clsi-sharelatex) [![Build Status](https://travis-ci.org/sharelatex/clsi-sharelatex.png?branch=master)](https://travis-ci.org/sharelatex/clsi-sharelatex)

The Common LaTeX Service Interface (CLSI) which provides an API for compiling LaTeX 
documents.

### [filestore](https://github.com/sharelatex/filestore-sharelatex) [![Build Status](https://travis-ci.org/sharelatex/filestore-sharelatex.png?branch=master)](https://travis-ci.org/sharelatex/filestore-sharelatex)

An API for performing CRUD (Create, Read, Update and Delete) operations on binary files
(like images) stored in ShareLaTeX.

Contributing
------------

Please see the [CONTRIBUTING](https://github.com/sharelatex/sharelatex/blob/master/CONTRIBUTING.md) file for information on contributing to the development of ShareLaTeX. See [our wiki](https://github.com/sharelatex/sharelatex/wiki/Developer-Guidelines) for information on setting up a development environment and how to recompile and run ShareLaTeX after modifications.

Authors
---

- [Henry Oswald](http://twitter.com/henryoswald)
- [James Allen](http://twitter.com/thejpallen)

License
----

The code in this repository is released under the GNU AFFERO GENERAL PUBLIC LICENSE, version 3. A copy can be found in the `LICENSE` file.

Copyright (c) ShareLaTeX, 2014.
