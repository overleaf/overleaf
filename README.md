ShareLaTeX is a web based collaborative LaTeX editor. There are two versions of it,
the online version that anyone can sign up to at www.sharelatex.com, and this open source
version which allows anyone to run a local installation of ShareLaTeX.

This repository pulls together all of the different services in ShareLaTeX's service
orientied architecture (SOA).

Installation
============

First, check out a local copy of this repository:

	$ git clone git@github.com:sharelatex/sharelatex.git
	$ cd sharelatex

Next run `npm install` to download all of the dependencies and services
(you need Node.js installed, version 0.10.0 or later):

	$ npm install

This can take a while, so now would be a good time for a cup of tea.
When that has finished, run ShareLaTeX with

	$ grunt run

ShareLaTeX should now be running at http://localhost:3000.

Dependencies
============

You need a local instance of Redis and Mongodb running on their standard ports.

Other repositories
==================

ShareLaTeX consists of many separate services, each with their own Node.js process
and source code repository. These are all downloaded when you run `npm install` and 
they are run when you run `grunt run`.

The different services are:

web-sharelatex
--------------

The front facing web server that serves all the HTML pages, CSS and javascript
to the client. Also contains a lot of logic around creating and editing
projects, and account management.

document-updater-sharelatex
---------------------------

Process updates that come in from the editor when users modify documents. Ensures that
the updates are applied in the right order, and that only one operation is modifying
the document at a time. Also caches the documents in redis for very fast but persistent
modifications.


