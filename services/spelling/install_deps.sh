echo 'APT::Default-Release "stretch";' >/etc/apt/apt.conf.d/default-release

# The following aspell packages exist in Ubuntu but not Debian:
# aspell-af, aspell-id, aspell-nr, aspell-ns, aspell-ss, aspell-st, aspell-tn, 
# aspell-ts, aspell-xh, aspell-zu
echo "deb http://us.archive.ubuntu.com/ubuntu/ bionic main universe" > /etc/apt/sources.list.d/bionic.list
apt-key adv --no-tty --keyserver keyserver.ubuntu.com --recv-keys 3B4FE6ACC0B21F32
# Need to install aspell-or, aspell-ta and aspell-te from testing (buster) as
# broken in stable (stretch).
echo "deb http://http.us.debian.org/debian/ unstable main" > /etc/apt/sources.list.d/unstable.list

apt-get update
apt-get install -y aspell aspell-en aspell-af aspell-am aspell-ar aspell-ar-large aspell-bg aspell-bn aspell-br aspell-ca aspell-cs aspell-cy aspell-da aspell-de aspell-de-alt aspell-el aspell-eo aspell-es aspell-et aspell-eu-es aspell-fa aspell-fo aspell-fr aspell-ga aspell-gl-minimos aspell-gu aspell-he aspell-hi aspell-hr aspell-hsb aspell-hu aspell-hy aspell-id aspell-is aspell-it aspell-kk aspell-kn aspell-ku aspell-lt aspell-lv aspell-ml aspell-mr aspell-nl aspell-nr aspell-ns  aspell-pa aspell-pl aspell-pt aspell-pt-br aspell-ro aspell-ru aspell-sk aspell-sl aspell-ss aspell-st aspell-sv aspell-tl aspell-tn aspell-ts aspell-uk aspell-uz aspell-xh aspell-zu

apt-get install aspell-or=0.03-1-6 aspell-te=0.01-2-6 aspell-no=2.2-4 aspell-ta=20040424-1-2
mkdir /app/cache
chown node:node /app/cache
chmod 0777 /app/cache
