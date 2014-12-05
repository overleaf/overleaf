if [ "$(id -u)" != "0" ]; then
	echo "You must be root to uninstall" 1>&2
	exit 1
fi
rm -f /usr/local/sbin/writelatex-git-bridge.jar &&\
rm -f /etc/init.d/wlgb &&\
/usr/sbin/update-rc.d -f wlgb remove
