if [ "$(id -u)" != "0" ]; then
	echo "You must be root to install" 1>&2
	exit 1
fi
ant all &&\
cp ./bin/writelatex-git-bridge.jar /usr/local/sbin/ &&\
cp ./bin/wlgb /etc/init.d/ &&\
/usr/sbin/update-rc.d -f wlgb defaults
