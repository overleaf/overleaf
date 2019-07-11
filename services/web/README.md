overleaf/web
==============

overleaf/web is the front-end web service of the open-source web-based collaborative LaTeX editor,
[Overleaf](https://www.overleaf.com).
It serves all the HTML pages, CSS and javascript to the client. overleaf/web also contains
a lot of logic around creating and editing projects, and account management.


The rest of the Overleaf stack, along with information about contributing can be found in the
[overleaf/ovelreaf](https://github.com/overleaf/overleaf) repository.

Build process
----------------

overleaf/web uses [Grunt](http://gruntjs.com/) to build its front-end related assets.

Image processing tasks are commented out in the gruntfile and the needed packages aren't presently in the project's `package.json`. If the images need to be processed again (minified and sprited), start by fetching the packages (`npm install grunt-contrib-imagemin grunt-sprity`), then *decomment* the tasks in `Gruntfile.coffee`. After this, the tasks can be called (explicitly, via `grunt imagemin` and `grunt sprity`).

New Docker-based build process
------------------------------

Note that the Grunt workflow from above should still work, but we are transitioning to a
Docker based testing workflow, which is documented below:

### Running the app

The app runs natively using npm and Node on the local system:

```
$ npm install
$ npm run start
```

*Ideally the app would run in Docker like the tests below, but with host networking not supported in OS X, we need to run it natively until all services are Dockerised.*

### Running Tests

To run all tests run:
```
make test
```

To run both unit and acceptance tests for a module run:
```
make test_module MODULE=overleaf-integration
```

### Unit Tests

The test suites run in Docker.

Unit tests can be run in the `test_unit` container defined in `docker-compose.tests.yml`.

The makefile contains a short cut to run these:

```
make test_unit
```

During development it is often useful to only run a subset of tests, which can be configured with arguments to the mocha CLI:

```
make test_unit MOCHA_GREP='AuthorizationManager'
```

To run only the unit tests for a single module do:
```
make test_unit_module MODULE=overleaf-integration
```

Module tests can also use a MOCHA_GREP argument:
```
make test_unit_module MODULE=overleaf-integration MOCHA_GREP=SSO
```

### Acceptance Tests

Acceptance tests are run against a live service, which runs in the `acceptance_test` container defined in `docker-compose.tests.yml`.

To run the tests out-of-the-box, the makefile defines:

```
make test_acceptance
```

However, during development it is often useful to leave the service running for rapid iteration on the acceptance tests. This can be done with:

```
make test_acceptance_app_start_service
make test_acceptance_app_run # Run as many times as needed during development
make test_acceptance_app_stop_service
```

`make test_acceptance` just runs these three commands in sequence and then runs `make test_acceptance_modules` which performs the tests for each module in the `modules` directory. (Note that there is not currently an equivalent to the `-start` / `-run` x _n_ / `-stop` series for modules.)

During development it is often useful to only run a subset of tests, which can be configured with arguments to the mocha CLI:

```
make test_acceptance_run MOCHA_GREP='AuthorizationManager'
```

To run only the acceptance tests for a single module do:
```
make test_acceptance_module MODULE=overleaf-integration
```

Module tests can also use a MOCHA_GREP argument:
```
make test_acceptance_module MODULE=overleaf-integration MOCHA_GREP=SSO
```

Routes
------

Run `bin/routes` to print out all routes in the project.


License and Credits
-------------------

This project is licensed under the [AGPLv3 license](http://www.gnu.org/licenses/agpl-3.0.html)

### Stylesheets

Overleaf is based on [Bootstrap](http://getbootstrap.com/), which is licensed under the
[MIT license](http://opensource.org/licenses/MIT).
All modifications (`*.less` files in `public/stylesheets`) are also licensed
under the MIT license.

### Artwork

#### Silk icon set 1.3

We gratefully acknowledge [Mark James](http://www.famfamfam.com/lab/icons/silk/) for
releasing his Silk icon set under the Creative Commons Attribution 2.5 license. Some
of these icons are used within Overleaf inside the `public/img/silk` and
`public/brand/icons` directories.

#### IconShock icons

We gratefully acknowledge [IconShock](http://www.iconshock.com) for use of the icons
in the `public/img/iconshock` directory found via
[findicons.com](http://findicons.com/icon/498089/height?id=526085#)

