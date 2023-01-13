@overleaf/project-history
==========================

An API for converting raw editor updates into a compressed and browseable history.

Running project-history
-----------------------

The app runs natively using npm and Node on the local system:

```
npm install
npm run start
```

Unit Tests
----------

The test suites run in Docker.

Unit tests can be run in the `test_unit` container defined in `docker-compose.tests.yml`.

The makefile contains a short cut to run these:

```
make install # Only needs running once, or when npm packages are updated
make test_unit
```

During development it is often useful to only run a subset of tests, which can be configured with arguments to the mocha CLI:

```
make test_unit MOCHA_ARGS='--grep=AuthorizationManager'
```

Acceptance Tests
----------------

Acceptance tests are run against a live service, which runs in the `acceptance_test` container defined in `docker-compose.tests.yml`.

To run the tests out-of-the-box, the makefile defines:

```
make install # Only needs running once, or when npm packages are updated
make test_acceptance
```

However, during development it is often useful to leave the service running for rapid iteration on the acceptance tests. This can be done with:

```
make test_acceptance_start_service
make test_acceptance_run # Run as many times as needed during development
make test_acceptance_stop_service
```

`make test_acceptance` just runs these three commands in sequence.

During development it is often useful to only run a subset of tests, which can be configured with arguments to the mocha CLI:

```
make test_acceptance_run MOCHA_ARGS='--grep=AuthorizationManager'
```

Makefile and npm scripts
------------------------

The commands used to compile the app and tests, to run the mocha tests, and to run the app are all in `package.json`. These commands call out to `coffee`, `mocha`, etc which are available to `npm` in the local `node_modules/.bin` directory, using the local versions. Normally, these commands should not be run directly, but instead run in docker via make.

The makefile contains a collection of shortcuts for running the npm scripts inside the appropriate docker containers, using the `docker-compose` files in the project.

Copyright (c) Overleaf, 2017-2021.
