docstore-sharelatex
===================

A CRUD API for storing and updating text documents in projects

[![Build Status](https://travis-ci.org/sharelatex/docstore-sharelatex.png?branch=master)](https://travis-ci.org/sharelatex/docstore-sharelatex)

Acceptance tests can be run with the command
```
docker run --rm -e AWS_BUCKET="<bucket-name>" -e AWS_ACCESS_KEY_ID=<aws-access-key> -e AWS_SECRET_ACCESS_KEY=<aws-secret-access-key> -v $(pwd):/app sharelatex/acceptance-test-runner
```
where `bucket-name`, `aws-access-key` and `aws-secret-access-key` are the credentials for an AWS S3 bucket.


License
-------

The code in this repository is released under the GNU AFFERO GENERAL PUBLIC LICENSE, version 3. A copy can be found in the `LICENSE` file.

Copyright (c) ShareLaTeX, 2014.
