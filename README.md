ShareLaTeX Docker Image
=======================

**Please read this entire file before installing ShareLaTeX via Docker. It's only
short but contains some important information.**

The recommended way to install and run ShareLaTeX Community Edition is via [Docker](https://www.docker.com/):

```
$ docker run -d \
  -v ~/sharelatex_data:/var/lib/sharelatex \
  -p 5000:80 \
  --name=sharelatex \
  sharelatex/sharelatex
```

This will download the ShareLaTeX image and start it running in the background on port 5000. You should be able to access it at http://localhost:5000/.

To stop ShareLaTeX:

```
docker stop sharelatex
```

and to start it again:

```
docker start sharelatex
```

If you want to permanently remove ShareLaTeX from your docker containers:

```
docker rm sharelatex
```

### Mongo and Redis

ShareLaTeX depends on [MongoDB](http://www.mongodb.org/) (must be 2.4 or later), and
[Redis](http://redis.io/) (must be version 2.6.12 or later).
These should be running on the host system.

Note that Docker containers each come with their own network stack, and Mongo and Redis
often listen by default on `127.0.0.1` which is not accessible on the host
from inside the Docker container. Instead, you should configure Mongo and Redis to
also listen on `172.17.42.1` (or whatever ip iddress the docker0 interface has on your
host). This can be done in `/etc/mongod.conf` and `/etc/redis/redis.conf`.

```
# /etc/mongod.conf
...
bind_ip = 172.17.42.1
...
```

```
# /etc/redis/redis.conf
...
bind 172.17.42.1
...
```

By default the ShareLaTeX Docker container looks for these running on the host
machine at port 27017 (for Mongo) and port 6379 (for Redis). These are the defaults
ports for both databases so you shouldn't need to change them.

If you want to point ShareLaTeX at a database in a different location, you can
configure the container with environment variables. See the **Configuration Options**
section below.

*Note that `localhost` in the container refers only to the container, so if you
want to access services on the host machine then you should use `dockerhost`.
`dockerhost` refers to the the `172.17.42.1` ip address mentioned above.* For example:

```
$ docker run -d \
  -v ~/sharelatex_data:/var/lib/sharelatex \
  -p 5000:80 \
  --name=sharelatex \
  --env SHARELATEX_MONGO_URL=mongodb://dockerhost/sharelatex \
  sharelatex/sharelatex
```

### Storing Data

The `-v ~/sharelatex_data:/var/lib/sharelatex` option in the `run` command tells 
Docker to make the host directory `~/sharelatex_data` available inside the container for 
ShareLaTeX to store data files in. This means that you can back up and access these
files manually outside of the ShareLaTeX container. If you would like to store ShareLaTeX data
in a different location, such as `/home/james/my_data`, just change this parameter:

```
$ docker run -d \
  -v /home/james/my_data:/var/lib/sharelatex \
  -p 80 \
  --name=sharelatex \
  sharelatex/sharelatex
```

Do not change the second part of this parameter (after the :).

This is only where ShareLaTeX stores on-disk data.
Other data is also stored in Mongo and Redis.

### Backups

To backup the ShareLaTeX data, you need to backup the directory you have attached
to the container, as above. You also need to backup the Mongo and Redis databases.

### Running on a different port

The container listens on port 80 by default so you should be able to access
ShareLaTeX at http://localhost/. If you would like to run ShareLaTeX on a different
port (perhaps you have another service running on port 80, or want to put a proxy
in front of ShareLaTeX), then you can forward port 80 from the Docker container
to any other port with the `-p <PORT>:80` option. For example, to have ShareLaTeX
listen on port 5000:

```
$ docker run -d \
  -v ~/sharelatex_data:/var/lib/sharelatex \
  -p 5000:80 \
  --name=sharelatex \
  --env SHARELATEX_SITE_URL=http://localhost:5000 \
  sharelatex/sharelatex
```

**(Note that you also have to update the `SHARELATEX_SITE_URL` parameter so that
ShareLaTeX knows where to refer to scripts and links that need loading.)**

### LaTeX environment

To save bandwidth, the ShareLaTeX image only comes with a minimal install of 
TeXLive. To upgrade to a complete TeXLive installation, run the following command:

```
$ docker exec sharelatex tlmgr install scheme-full
```

Or you can install packages manually as you need by replacing `scheme-full` by 
the package name.

### Configuration Options

You can pass configuration options to ShareLaTeX as environment variables:

```
$ docker run -d \
  -v ~/sharelatex_data:/var/lib/sharelatex \
  -p 5000:80 \
  --name=sharelatex \
  --env SHARELATEX_MONGO_URL=mongodb://my.mongo.host/sharelatex \
  sharelatex/sharelatex
```

The available configuration parameters are:

* `SHARELATEX_SITE_URL`: Where your instance of ShareLaTeX is publically available.
This is used in public links, and when connecting over websockets, so much be
configured correctly!
* `SHARELATEX_ADMIN_EMAIL`: The email address where users can reach the person who runs the site.
* `SHARELATEX_APP_NAME`: The name to display when talking about the running app. Defaults to 'ShareLaTex (Community Edition)'.
* `SHARELATEX_MONGO_URL`: The URL of the Mongo database to use
* `SHARELATEX_REDIS_HOST`: The host name of the Redis instance to use
* `SHARELATEX_REDIS_PORT`: The port of the Redis instance to use
* `SHARELATEX_REDIS_PASS`: The password to use when connecting to Redis (if applicable)
* `SHARELATEX_SECURE_COOKIE`: Set this to something non-zero to use a secure cookie.
  Only use this if your ShareLaTeX instance is running behind a reverse proxy with SSL configured.

### Creating and Managing users

Uun the following command to create your first user and make them an admin:

```
$ docker exec sharelatex /bin/bash -c "cd /var/www/sharelatex/web; grunt create-admin-user --email joe@example.com"
```

This will create a user with the given email address if they don't already exist, and make them an admin user. You will be given a URL to visit where you can set the password for this user and log in for the first time.

**Creating normal users**

Once you are logged in as an admin user, you can visit `/admin/register` on your ShareLaTeX instance and create a new users. If you have an email backend configured in your settings file, the new users will be sent an email with a URL to set their password. If not, you will have to distribute the password reset URLs manually. These are shown when you create a user.

### Upgrading from older versions

*Please make sure to back up all Mongo, Redis and on-disk data before upgrading.*

Stop and remove the currently running ShareLaTeX container:

```
$ docker stop sharelatex
$ docker rm sharelatex
```

Start a new container with the updated version of ShareLaTeX (to upgrade to version 1.4.0 for example):

```
$ docker run -d -v ~/sharelatex_data:/var/lib/sharelatex --name=sharelatex sharelatex/sharelatex:1.4.0
```
