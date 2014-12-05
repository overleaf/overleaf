if [ "$(id -u)" != "0" ]; then
	echo "You must be root to install deps" 1>&2
	exit 1
fi
apt-get update
apt-get install ant
apt-get install openjdk-7-jdk
update-alternatives --set java /usr/lib/java-7-openjdk-amd64/jre/bin/java
update-alternatives --set javac /usr/lib/java-7-openjdk-amd64/jre/bin/javac
