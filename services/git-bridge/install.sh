if [ "$(id -u)" != "0" ]; then
	echo "You must be root to install" 1>&2
	exit 1
fi
command -v ant >/dev/null 2>&1 && command -v /usr/lib/jvm/java-7-openjdk-amd64/bin/javac >/dev/null 2>&1 || installDeps()
mvn package &&\
mv ./target/writelatex-git-bridge-1.0-SNAPSHOT-jar-with-dependencies.jar /usr/local/sbin/ &&\
cp ./bin/wlgb /etc/init.d/ &&\
mkdir -p /var/log/wlgb &&\
mkdir -p /etc/wlgb &&\
cp ./bin/config.json /etc/wlgb/ &&\
/usr/sbin/update-rc.d -f wlgb defaults

installDeps() {
	apt-get update
	apt-get install -y maven2
	apt-get install -y openjdk-7-jdk
	update-alternatives --set java /usr/lib/jvm/java-7-openjdk-amd64/jre/bin/java
	update-alternatives --set javac /usr/lib/jvm/java-7-openjdk-amd64/jre/bin/javac
	return 1
}
