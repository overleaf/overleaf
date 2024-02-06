overleaf/filestore
====================

An API for CRUD operations on binary files stored in S3

filestore acts as a proxy between the CLSIs and (currently) Amazon S3 storage, presenting a RESTful HTTP interface to the CLSIs on port 3009 by default. Urls are mapped to node functions in https://github.com/overleaf/filestore/blob/master/app.coffee . URLs are of the form:

* `/project/:project_id/file/:file_id`
* `/template/:template_id/v/:version/:format`
* `/project/:project_id/public/:public_file_id`
* `/project/:project_id/size`
* `/bucket/:bucket/key/*`
* `/shutdown`
* `/status` - returns HTTP 200 `filestore is up` or HTTP 503 when shutting down
* `/health_check`

License
-------

The code in this repository is released under the GNU AFFERO GENERAL PUBLIC LICENSE, version 3. A copy can be found in the `LICENSE` file.

Copyright (c) Overleaf, 2014-2019.
