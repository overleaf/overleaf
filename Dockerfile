# 
# ShareLaTeX all-in-one Dockerfile
#
# https://github.com/wtsi-hgi/sharelatex
# 
# Builds a docker container with ShareLaTeX and all prerequisites installed.
# Note that if using docker in production, you may want to split out individual 
# components into their own containers and connect them using networking.

FROM jrandall/texlive
MAINTAINER "Joshua C. Randall" <jcrandall@alum.mit.edu>

# Install basic prerequisites
RUN apt-get -qqy update \
&& apt-get -qqy install git build-essential curl python-software-properties zlib1g-dev zip unzip wget

# Install Node.js
RUN apt-add-repository -y ppa:chris-lea/node.js \
&& apt-get -qqy update \
&& apt-get -qqy install nodejs\
&& npm install -g grunt-cli

# Install Redis
RUN apt-add-repository -y ppa:chris-lea/redis-server \
&& apt-get -qqy update \
&& apt-get -qqy install redis-server

# Install MongoDB
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10 \
&& (echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' > /etc/apt/sources.list.d/mongodb.list) \
&& apt-get -qqy update \
&& apt-get -qqy install mongodb-org

# Install Aspell
RUN apt-get -qqy install aspell

# Install nginx
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv ABF5BD827BD9BF62 \
&& (echo 'deb http://nginx.org/packages/ubuntu/ precise nginx' > /etc/apt/sources.list.d/nginx.list) \
&& apt-get -qqy update \
&& apt-get -qqy install nginx \
&& rm /etc/nginx/conf.d/default.conf
ADD package/nginx/sharelatex /etc/nginx/conf.d/sharelatex.conf

# Install sharelatex from git
ADD . /var/www/sharelatex
WORKDIR /var/www/sharelatex

# Install node modules
RUN npm install

# Compile and install ShareLaTeX
RUN grunt install

# Install and customize config file
ENV SHARELATEX_CONFIG /etc/sharelatex/settings.coffee
RUN mkdir -p /etc/sharelatex \
&& mv config/settings.development.coffee $SHARELATEX_CONFIG \
&& perl -pi -e 's/behindProxy:.*/behindProxy: true/; s/DATA_DIR\s*=.*/DATA_DIR = "\/data\/sharelatex"/; s/TMP_DIR\s*=.*/TMP_DIR = "\/data\/sharelatex\/tmp"/;' $SHARELATEX_CONFIG

# Workaround for "Error: Could not load the bindings file" error
RUN (cd web && rm -r node_modules/bcrypt && npm install bcrypt)

# Install supervisord to manage all-in-one-container process management
RUN apt-get -qqy install supervisor
ADD package/docker/supervisor_conf.d /etc/supervisor/conf.d

# Install entrypoint script
ADD package/docker/sharelatex-entrypoint.sh /usr/bin/sharelatex-entrypoint.sh

# Set supervisord as the default entrypoint
ENTRYPOINT ["/usr/bin/sharelatex-entrypoint.sh"]

# Declare data and logging directories as volumes
VOLUME ["/data"]
VOLUME ["/var/log"]

# nginx listens on port 80
EXPOSE 80

