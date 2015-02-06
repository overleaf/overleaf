ShareLaTeX Docker Image
=======================

*THIS IS A WORK IN PROGRESS AND THESE INSTRUCTIONS DO NOT WORK YET!*

The recommended way to install and run ShareLaTeX Community Edition is via Docker:

```
$ docker run -d -v /sharelatex-data:/var/lib/sharelatex --net=host --name=sharelatex sharelatex/sharelatex
```

This will download the ShareLaTeX image and start it running in the background.

**Which port does it listen on?**.

### Mongo and Redis

The `--net=host` option to docker will allow the ShareLaTeX container to access
ports on the local system. By default it looks for an instance of
[MongoDB](http://www.mongodb.org/) (must be version 2.4 or later) running on port 27017, and
[Redis](http://redis.io/) (must be version 2.6.12 or later) running on port 6379. These are the default ports for
a standard installation of MongoDB and Redis.

### Persisting and backing up data

The `-v /sharelatex-data:/var/lib/sharelatex` option in the `run` command tells Docker to mount the local
directory `/sharelatex-data` in the container at `/var/lib/sharelatex`. This is
where ShareLaTeX will store user uploaded files, and allows you to make external backups
of these files, as well as persist them between updates to the ShareLaTeX image.

### LaTeX environment

To save bandwidth, the ShareLaTeX image only comes with a minimal install of 
TeXLive. To upgrade to a complete TeXLive installation, run the following command:

```
$ docker exec sharelatex tlmgr install scheme-full
```

Or you can install packages manually as you need by replacing `scheme-full` by 
the package name

### Configuration Options

You can pass configuration options to ShareLaTeX as environment variables:

```
$ docker run -d \
	-v /sharelatex-data:/var/lib/sharelatex \
	--net=host \
	--name=sharelatex \
	--env SHARELATEX_MONGO_URL=mongodb://my.mongo.host/sharelatex \
	sharelatex/sharelatex
```

The available configuration parameters are:

* `SHARELATEX_SITE_URL`: Where your instance of ShareLaTeX is publically available.
This is used in public links, and when connecting over websockets, so much be
configured correctly!
* `SHARELATEX_MONGO_URL`: The URL of the Mongo database to use
* `SHARELATEX_REDIS_HOST`: The host name of the Redis instance to use
* `SHARELATEX_REDIS_PORT`: The port of the Redis instance to use
* `SHARELATEX_REDIS_PASS`: The password to use when connecting to Redis (if applicable)
* `SHARELATEX_SECURE_COOKIE`: Set this to something non-zero to use a secure cookie.
  This requires that your ShareLaTeX instance is running behind SSL.

### Upgrading from older versions

*TODO: Just stop container, remove 'sharelatex' tag, and run with the new version.*