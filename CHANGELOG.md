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
