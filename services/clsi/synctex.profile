include /etc/firejail/disable-common.inc
include /etc/firejail/disable-devel.inc
# include /etc/firejail/disable-mgmt.inc  ## removed in 0.9.40
# include /etc/firejail/disable-secret.inc ## removed in 0.9.40

read-only /bin
blacklist /boot
blacklist /dev
read-only /etc
blacklist /home # blacklisted for synctex
read-only /lib
read-only /lib64
blacklist /media
blacklist /mnt
blacklist /opt
blacklist /root
read-only /run
blacklist /sbin
blacklist /selinux
blacklist /src
blacklist /sys
read-only /usr

caps.drop all
noroot
nogroups
net none
private-tmp
private-dev
shell none
seccomp
nonewprivs


