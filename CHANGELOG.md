v0.1.4
------

* Move to a private registration scheme where users must be added by an admin.
* Proxy websockets connection through web to real-time service so no websocketsUrl parameter is needed.
* Use worker aspell processes in spelling to prevent excessing forking.
* Properly clean up after long running ImageMagick conversions in the filestore.
* Allow a configurable app name and email contact address.
* Switch to new PDF viewer with partial page loading for immediate preview of visible page.

v0.1.3
------

* Fix bug with large files being corrupted when downloaded.
* Update Ace editor to lastest release.
* Lots of added null checks in the front-end javascript.
* Don't crash if 'unzip' program isn't present.
* Allow track-changes history to be packed into compressed 'packs'. This must be done manually for now.
* Escape any shell special characters in the CLSI root path.

v0.1.2
------

* Re-brand open-source ShareLaTeX code as 'ShareLaTeX Community Edition'.
* The Dropbox and template code has been extracted out into a separate module and removed from the ShareLaTeX Community Edition. There should be no broken features due to lack of open source components now.
* Websockets and real-time data now go to a separate light-weight [real-time](https://github.com/sharelatex/real-time) service.
* Updated PDF viewer that loads page-by-page for much quicker loading times on large documents.
* Links are clickable in chat messages.
* Mathjax libraries are now served locally.
* Optimisation of Angular digest loop in editor should reduce CPU usage in certain cases.
* Numerous small bug fixes.
