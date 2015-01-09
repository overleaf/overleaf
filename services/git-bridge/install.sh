command -v ant >/dev/null 2>&1 && command -v /usr/lib/jvm/java-7-openjdk-amd64/bin/javac >/dev/null 2>&1 || installDeps
mvn package &&\
sudo mv ./target/writelatex-git-bridge-1.0-SNAPSHOT-jar-with-dependencies.jar /usr/local/sbin/writelatex-git-bridge.jar &&\
sudo cp ./bin/wlgb /etc/init.d/ &&\
sudo mkdir -p /var/log/wlgb &&\
sudo mkdir -p /etc/wlgb &&\
if [ -f /etc/wlgb/config.json ]; then
    sudo cp ./bin/config.json /etc/wlgb/
fi &&\
sudo /usr/sbin/update-rc.d -f wlgb defaults

installDeps() {
	sudo apt-get update
	sudo apt-get install -y maven2
	sudo apt-get install -y openjdk-7-jdk
	sudo update-alternatives --set java /usr/lib/jvm/java-7-openjdk-amd64/jre/bin/java
	sudo update-alternatives --set javac /usr/lib/jvm/java-7-openjdk-amd64/jre/bin/javac
	return 1
}
