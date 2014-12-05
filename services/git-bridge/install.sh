if [ "$(id -u)" != "0" ]; then
	echo "You must be root to install" 1>&2
	exit 1
fi
command -v ant >/dev/null 2>&1 && command -v /usr/lib/jvm/java-7-openjdk-amd64/bin/javac >/dev/null 2>&1 || ./install-deps.sh
ant all &&\
mv ./bin/writelatex-git-bridge.jar /usr/local/sbin/ &&\
cp ./bin/wlgb /etc/init.d/ &&\
mkdir -p /var/log/wlgb &&\
mkdir -p /etc/wlgb &&\
cp ./bin/config.json /etc/wlgb/ &&\
/usr/sbin/update-rc.d -f wlgb defaults
