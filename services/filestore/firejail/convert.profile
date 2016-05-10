# Convert (ImageMagick profile)

include /etc/firejail/disable-common.inc
include /etc/firejail/disable-devel.inc
include /etc/firejail/disable-mgmt.inc
include /etc/firejail/disable-secret.inc

read-only /bin
blacklist /boot
blacklist /dev
read-only /etc
read-only /home
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
blacklist /var

caps.drop all
noroot
nogroups
protocol unix
net none
private-tmp
private-dev
shell none
seccomp.keep access,arch_prctl,brk,chown,clone,close,dup,execve,exit_group,fcntl,fstat,futex,getcwd,getdents,getegid,geteuid,getgid,getpeername,getpgrp,getpid,getppid,getrlimit,getrusage,getuid,ioctl,lseek,mmap,mprotect,munmap,nanosleep,open,openat,prctl,read,readlink,rt_sigaction,rt_sigprocmask,sched_getaffinity,set_robust_list,set_tid_address,stat,symlink,times,uname,unlink,unshare,wait4,write,madvise

rlimit-fsize 524288000 #500Mb
rlimit-nproc 200
rlimit-nofile 100