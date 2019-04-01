ShareLaTeX
==========

[ShareLaTeX](https://www.sharelatex.com) is an open-source online real-time collaborative LaTeX editor. We run a hosted version at http://www.sharelatex.com, but you can also run your own local version, and contribute to the development of ShareLaTeX.

*[If you want help installing and maintaining ShareLaTeX at your university or workplace, we offer an officially supported version called ShareLaTeX Server Pro. It also comes with extra security and admin features. Click here to find out more!](https://www.sharelatex.com/university/onsite.html)*

Keeping up to date
------------
Sign up to the [mailing list](http://eepurl.com/bPWeiH) to get updates on ShareLaTeX Releases and development

Installation
------------

We have detailed installation instructions in our wiki:

* [ShareLaTeX Quick Start Guide](https://github.com/sharelatex/sharelatex/wiki/Quick-Start-Guide)


Upgrading
---------

If you are upgrading from a previous version of ShareLaTeX, please see the [Release Notes section on the Wiki](https://github.com/sharelatex/sharelatex/wiki/Home) for all of the versions between your current version and the version you are upgrading to.


Other repositories
------------------

This repository does not contain any code. It acts a wrapper and toolkit for managing the many different ShareLaTeX  services. These each run as their own Node.js process and have their own Github repository. These are all downloaded and set up when you run `grunt install`

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

### [docstore](https://github.com/sharelatex/docstore-sharelatex)

An API for performing CRUD (Create, Read, Update and Delete) operations on text files
stored in ShareLaTeX.

### [realtime](https://github.com/sharelatex/real-time-sharelatex)

The websocket process clients connect to

### [filestore](https://github.com/sharelatex/filestore-sharelatex)

An API for performing CRUD (Create, Read, Update and Delete) operations on binary files
(like images) stored in ShareLaTeX.

### [track-changes](https://github.com/sharelatex/track-changes-sharelatex)

An API for compressing and storing the updates applied to a document, and then rendering a diff of the changes
between any two time points.

### [chat](https://github.com/sharelatex/chat-sharelatex)

The backend API for storing and fetching chat messages.

### [tags](https://github.com/sharelatex/tags-sharelatex)

The backend API for managing project tags (folders).

### [spelling](https://github.com/sharelatex/spelling-sharelatex)

An API for running server-side spelling checking on ShareLaTeX documents.

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
