web-sharelatex
==============

web-sharelatex is the front-end web service of the open-source web-based collaborative LaTeX editor,
[ShareLaTeX](https://www.sharelatex.com).
It serves all the HTML pages, CSS and javascript to the client. web-sharelatex also contains 
a lot of logic around creating and editing projects, and account management.


The rest of the ShareLaTeX stack, along with information about contributing can be found in the 
[sharelatex/sharelatex](https://github.com/sharelatex/sharelatex) repository.

Build process
----------------

web-sharelatex uses [Grunt](http://gruntjs.com/) to build its front-end related assets.

Image processing tasks are commented out in the gruntfile and the needed packages aren't presently in the project's `package.json`. If the images need to be processed again (minified and sprited), start by fetching the packages (`npm install grunt-contrib-imagemin grunt-sprity`), then *decomment* the tasks in `Gruntfile.coffee`. After this, the tasks can be called (explicitly, via `grunt imagemin` and `grunt sprity`).

Unit test status
----------------

[![Unit test status](https://travis-ci.org/sharelatex/web-sharelatex.png?branch=master)](https://travis-ci.org/sharelatex/web-sharelatex)

License and Credits
-------------------

This project is licensed under the [AGPLv3 license](http://www.gnu.org/licenses/agpl-3.0.html)

### Stylesheets

ShareLaTeX is based on [Bootstrap](http://getbootstrap.com/), which is licensed under the
[MIT license](http://opensource.org/licenses/MIT).
All modifications (`*.less` files in `public/stylesheets`) are also licensed
under the MIT license.

### Artwork

#### Silk icon set 1.3

We gratefully acknowledge [Mark James](http://www.famfamfam.com/lab/icons/silk/) for
releasing his Silk icon set under the Creative Commons Attribution 2.5 license. Some
of these icons are used within ShareLaTeX inside the `public/img/silk` and
`public/brand/icons` directories.

#### IconShock icons

We gratefully acknowledge [IconShock](http://www.iconshock.com) for use of the icons
in the `public/img/iconshock` directory found via
[findicons.com](http://findicons.com/icon/498089/height?id=526085#)


## Acceptance Tests

To run the Acceptance tests:

- set `allowPublicAccess` to true, either in the configuration file,
  or by setting the environment variable `SHARELATEX_ALLOW_PUBLIC_ACCESS` to `true`
- start the server (`grunt`)
- in a separate terminal, run `grunt test:acceptance`
