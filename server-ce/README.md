ShareLaTeX
==========

[ShareLaTeX](https://www.sharelatex.com) is now open source! ShareLaTeX is an online real-time collaborative LaTeX editor, and you can now run your own local version where you can host, edit, collaborate in real-time, and compile your LaTeX documents. We’re still 100% focused on running the hosted version at http://www.sharelatex.com, but we want to be more flexible in how you can use ShareLaTeX, and give something back to our wonderful community.

**[Read more on our blog](https://www.sharelatex.com/blog/2014/02/21/sharelatex-is-now-open-source.html#.UwcnsEJ_ugc)**
or **[join in the discussion on Hacker News](https://news.ycombinator.com/item?id=7276263)**

Installation
------------

ShareLaTeX uses a service orientied architecture (SOA) where we have lots of small
APIs that talk to each other over HTTP and Redis pub-sub channels. This repository
pulls together all of the different services and allows you to set up and run
them quickly.

*Note: Please make sure you have your public key configured with github since
we use ssh to pull additional repositories from github when you run the install
script.*

First, check out a local copy of this repository:

	$ git clone git@github.com:sharelatex/sharelatex.git
	$ cd sharelatex

Next install all the node modules and ShareLaTeX services:

	$ npm install
	$ grunt install

When that has finished, run ShareLaTeX with

	$ grunt run

ShareLaTeX should now be running at http://localhost:3000.

Dependencies
------------

ShareLaTeX should run on OS X and Linux. You need:

* [Node.js](http://nodejs.org/) 0.10 or greater
* The [grunt](http://gruntjs.com/) command line tools (Run `npm install -g grunt-cli` to install them)
* A local instance of [Redis](http://redis.io/) (version 2.6 or later) and [MongoDB](http://www.mongodb.org/) running on their standard ports.
* An up to date version of [TeXLive](https://www.tug.org/texlive/), with the `latexmk` program installed (should be included by default in TeXLive).

Config
------

ShareLaTeX should mostly run out of the box, although it uses Amazon S3 for storing binary
files like images. You will need to configure ShareLaTeX to use your own S3 access key
which can be done by editing the file at `config/settings.development.coffee`

A local settings file can be specified by setting the `SHARELATEX_CONFIG` environment variable
to point to your own settings file. E.g.

	$ export SHARELATEX_CONFIG=/home/james/config/settings.development.coffee

Other repositories
------------------

ShareLaTeX consists of many separate services, each with their own Node.js process
and source code repository. These are all downloaded and set upwhen you run
`grunt install`

The different services are:

### [web](https://github.com/sharelatex/web-sharelatex)

The front facing web server that serves all the HTML pages, CSS and JavaScript
to the client. Also contains a lot of logic around creating and editing
projects, and account management.

### [document-updater](https://github.com/sharelatex/document-updater-sharelatex)

Processes updates that come in from the editor when users modify documents. Ensures that
the updates are applied in the right order, and that only one operation is modifying
the document at a time. Also caches the documents in redis for very fast but persistent
modifications.

### [CLSI](https://github.com/sharelatex/clsi-sharelatex)

The Common LaTeX Service Interface (CLSI) which provides an API for compiling LaTeX 
documents.

### [filestore](https://github.com/sharelatex/filestore-sharelatex)

An API for performing CRUD (Create, Read, Update and Delete) operations on binary files
(like images) stored in ShareLaTeX.

Contributing
------------

Please see the [CONTRIBUTING](https://github.com/sharelatex/sharelatex/blob/master/CONTRIBUTING.md) file for information on contributing to the development of ShareLaTeX.

Authors
---

- [Henry Oswald](http://twitter.com/henryoswald)
- [James Allen](http://twitter.com/thejpallen)

License
----

The code in this repository is released under the GNU AFFERO GENERAL PUBLIC LICENSE, version 3. A copy can be found in the `LICENSE` file.

Copyright (c) ShareLaTeX, 2014.
