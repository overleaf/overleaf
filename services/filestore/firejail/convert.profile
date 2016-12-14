# Convert (ImageMagick profile)

include /etc/firejail/disable-common.inc
include /etc/firejail/disable-devel.inc
# include /etc/firejail/disable-mgmt.inc ## removed in firejail 0.9.40
# include /etc/firejail/disable-secret.inc ## removed in firejail 0.9.40

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

seccomp.keep accept,accept4,access,alarm,arch_prctl,bind,brk,capget,capset,chdir,chmod,chown,chroot,clock_getres,clock_gettime,clock_nanosleep,clone,close,connect,creat,dup,dup2,dup3,epoll_create,epoll_create1,epoll_ctl,epoll_ctl_old,epoll_pwait,epoll_wait,epoll_wait_old,eventfd,eventfd2,execve,execveat,exit,exit_group,faccessat,fadvise64,fallocate,fanotify_init,fanotify_mark,fchdir,fchmod,fchmodat,fchown,fchownat,fcntl,fdatasync,fgetxattr,flistxattr,flock,fork,fremovexattr,fsetxattr,fstat,fstatfs,fsync,ftruncate,futex,futimesat,get_robust_list,get_thread_area,getcpu,getcwd,getdents,getdents64,getegid,geteuid,getgid,getgroups,getitimer,getpeername,getpgid,getpgrp,getpid,getppid,getpriority,getrandom,getresgid,getresuid,getrlimit,getrusage,getsid,getsockname,getsockopt,gettid,gettimeofday,getuid,getxattr,inotify_add_watch,inotify_init,inotify_init1,inotify_rm_watch,io_cancel,io_destroy,io_getevents,io_setup,io_submit,ioctl,ioprio_get,ioprio_set,kill,lchown,lgetxattr,link,linkat,listen,listxattr,llistxattr,lremovexattr,lseek,lsetxattr,lstat,madvise,memfd_create,mincore,mkdir,mkdirat,mknod,mknodat,mlock,mlockall,mmap,modify_ldt,mprotect,mq_getsetattr,mq_notify,mq_open,mq_timedreceive,mq_timedsend,mq_unlink,mremap,msgctl,msgget,msgrcv,msgsnd,msync,munlock,munlockall,munmap,nanosleep,newfstatat,open,openat,pause,personality,pipe,pipe2,poll,ppoll,prctl,pread64,preadv,prlimit64,pselect6,pwrite64,pwritev,read,readahead,readlink,readlinkat,readv,recvfrom,recvmmsg,recvmsg,remap_file_pages,removexattr,rename,renameat,renameat2,restart_syscall,rmdir,rt_sigaction,rt_sigpending,rt_sigprocmask,rt_sigqueueinfo,rt_sigreturn,rt_sigsuspend,rt_sigtimedwait,rt_tgsigqueueinfo,sched_get_priority_max,sched_get_priority_min,sched_getaffinity,sched_getattr,sched_getparam,sched_getscheduler,sched_rr_get_interval,sched_setaffinity,sched_setattr,sched_setparam,sched_setscheduler,sched_yield,seccomp,select,semctl,semget,semop,semtimedop,sendfile,sendmmsg,sendmsg,sendto,set_robust_list,set_thread_area,set_tid_address,setdomainname,setfsgid,setfsuid,setgid,setgroups,sethostname,setitimer,setpgid,setpriority,setregid,setresgid,setresuid,setreuid,setrlimit,setsid,setsockopt,setuid,setxattr,shmat,shmctl,shmdt,shmget,shutdown,sigaltstack,signalfd,signalfd4,socket,socketpair,splice,stat,statfs,symlink,symlinkat,sync,sync_file_range,syncfs,sysinfo,syslog,tee,tgkill,time,timer_create,timer_delete,timer_getoverrun,timer_gettime,timer_settime,timerfd_create,timerfd_gettime,timerfd_settime,times,tkill,truncate,umask,uname,unlink,unlinkat,utime,utimensat,utimes,vfork,vhangup,vmsplice,wait4,waitid,write,writev,unshare

rlimit-fsize 524288000 #500Mb
rlimit-nproc 600 #if too low this can cause error: Error fork:sandbox(774): Resource temporarily unavailable
rlimit-nofile 100