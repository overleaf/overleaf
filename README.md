ShareLaTeX
==========

[ShareLaTeX](https://www.sharelatex.com) is now open source! ShareLaTeX is an online real-time collaborative LaTeX editor, and you can now run your own local version where you can host, edit, collaborate in real-time, and compile your LaTeX documents. We’re still 100% focused on running the hosted version at http://www.sharelatex.com, but we want to be more flexible in how you can use ShareLaTeX, and give something back to our wonderful community.

**[Read more on our blog](https://www.sharelatex.com/blog/2014/02/21/sharelatex-is-now-open-source.html#.UwcnsEJ_ugc)**

Installation
------------

**[Please help us make ShareLaTeX as easy to install as possible by answering our quick survey about your system and needs](https://sharelatex.typeform.com/to/PLNits)**

We're still figuring out the easiest way to let you install ShareLaTeX and get up and running quickly. If you fill in the above survey in we will be eternally grateful and it will help us make this install process as smooth as possible. For now, here is the best ways:

### Manually

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

### With Vagrant

There is a Vagrant and Ansible backed VM installation script for ShareLaTeX, maintained by [@palkan](https://github/palkan), available here: https://github.com/palkan/sharelatex-vagrant-ansible

### With Docker

An [automatic docker-based installer](https://github.com/tiagoboldt/sharelatex-docker) is available. It depends on docker and will build a production environment for running ShareLaTeX on any supported platform.

Dependencies
------------

ShareLaTeX should run on OS X and Linux. You need:

* [Node.js](http://nodejs.org/) 0.10 or greater. We recommend that you use [nvm](https://github.com/creationix/nvm) to install it.
* The [grunt](http://gruntjs.com/) command line tools (Run `npm install -g grunt-cli` to install them)
* A local instance of [Redis](http://redis.io/topics/quickstart) (version 2.6.12 or later) and [MongoDB](http://docs.mongodb.org/manual/installation/) running on their standard ports.
* [TeXLive](https://www.tug.org/texlive/) 2013 or later with the `latexmk` program installed.

Config
------

ShareLaTeX should run out of the box, but if you want to adjust any settings you can do so by
editing the `config/settings.development.coffee` file. Available options are explained inline.

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

### [track-changes](https://github.com/sharelatex/track-changes-sharelatex) [![Build Status](https://travis-ci.org/sharelatex/track-changes-sharelatex.png?branch=master)](https://travis-ci.org/sharelatex/track-changes-sharelatex)

An API for compressing and storing the updates applied to a document, and then rendering a diff of the changes
between any two time points. *Still in development and not hooked into the UI yet*.

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
