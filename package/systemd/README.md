### Set of example files to manage ShareLaTeX services using systemd
These installation instructions should work on Red Hat/CentOS 7 systems or any other system that uses the standard systemd specified paths.

To install in the standard paths, use the following
```
  cp sharelatex@.service /etc/systemd/system/
  mkdir -p /etc/sharelatex
  cp sharelatex.env /etc/sharelatex/
  cp start_module.sh /etc/sharelatex/
  chmod +x /etc/sharelatex/start_module.sh
```

Now to manage services using systemd, you will use the syntax sharelatex@modulename.service, for example, to start the web module you would type
```
  systemctl start sharelatex@web.service
```
