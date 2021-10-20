FROM phusion/baseimage:0.11

ADD server-ce/genScript.js /var/www/sharelatex/genScript.js
ADD server-ce/services.js /var/www/sharelatex/services.js

COPY server-ce/init_scripts/ /etc/my_init.d/

ENTRYPOINT ["/sbin/my_init"]