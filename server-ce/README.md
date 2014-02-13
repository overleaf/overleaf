ShareLaTeX
==========

ShareLaTeX is a web-based collaborative LaTeX editor. We run a hosted service at
https://www.sharelatex.com and this repository contains the open source code that
powers it and allows you to run a local installation.

ShareLaTeX uses a service orientied architecture (SOA) where we have lots of small
APIs that talk to each other over HTTP and Redis pub-sub channels. This repository
pulls together all of the different services and allows you to set up and run
them quickly.

Installation
------------

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

You need:

* Node.js 0.10 or greater
* The grunt command line tools (Run `npm install -g grunt-cli` to install them)
* A local instance of Redis and Mongodb running on their standard ports.

Config
------

ShareLaTeX should mostly run out of the box, although it uses Amazon S3 for storing binary
files like images. You will need to configure ShareLaTeX to use your own S3 access key
which can be done by editing the file at `config/settings.development.coffee`

Other repositories
------------------

ShareLaTeX consists of many separate services, each with their own Node.js process
and source code repository. These are all downloaded and set upwhen you run
`grunt install`

The different services are:

### [web](http://github.com/sharelatex/web-sharelatex)

The front facing web server that serves all the HTML pages, CSS and javascript
to the client. Also contains a lot of logic around creating and editing
projects, and account management.

### [document-updater](http://github.com/sharelatex/document-updater-sharelatex)

Process updates that come in from the editor when users modify documents. Ensures that
the updates are applied in the right order, and that only one operation is modifying
the document at a time. Also caches the documents in redis for very fast but persistent
modifications.

### [CLSI](http://github.com/sharelatex/clsi-sharelatex)

The Common LaTeX Service Interface (CLSI) which provides an API for compiling LaTeX 
documents.

Contributing
------------

Please see the [CONTRIBUTING](https://github.com/sharelatex/sharelatex/blob/master/CONTRIBUTING.md) file for information on contributing to the development of ShareLaTeX.

