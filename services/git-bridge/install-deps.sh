if [ "$(id -u)" != "0" ]; then
	echo "You must be root to install deps" 1>&2
	exit 1
fi
apt-get update
apt-get install -y ant
apt-get install -y openjdk-7-jdk
update-alternatives --set java /usr/lib/jvm/java-7-openjdk-amd64/jre/bin/java
update-alternatives --set javac /usr/lib/jvm/java-7-openjdk-amd64/jre/bin/javac
