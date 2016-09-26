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
seccomp.keep accept,accept4,access,alarm,arch_prctl,bind,brk,capget,capset,chdir,chmod,chown,chown32,chroot,clock_getres,clock_gettime,clock_nanosleep,clone,close,connect,copy_file_range,creat,dup,dup2,dup3,epoll_create,epoll_create1,epoll_ctl,epoll_ctl_old,epoll_pwait,epoll_wait,epoll_wait_old,eventfd,eventfd2,execve,execveat,exit,exit_group,faccessat,fadvise64,fadvise64_64,fallocate,fanotify_init,fanotify_mark,fchdir,fchmod,fchmodat,fchown,fchown32,fchownat,fcntl,fcntl64,fdatasync,fgetxattr,flistxattr,flock,fork,fremovexattr,fsetxattr,fstat,fstat64,fstatat64,fstatfs,fstatfs64,fsync,ftruncate,ftruncate64,futex,futimesat,getcpu,getcwd,getdents,getdents64,getegid,getegid32,geteuid,geteuid32,getgid,getgid32,getgroups,getgroups32,getitimer,getpeername,getpgid,getpgrp,getpid,getppid,getpriority,getrandom,getresgid,getresgid32,getresuid,getresuid32,getrlimit,get_robust_list,getrusage,getsid,getsockname,getsockopt,get_thread_area,gettid,gettimeofday,getuid,getuid32,getxattr,inotify_add_watch,inotify_init,inotify_init1,inotify_rm_watch,io_cancel,ioctl,io_destroy,io_getevents,ioprio_get,ioprio_set,io_setup,io_submit,ipc,kill,lchown,lchown32,lgetxattr,link,linkat,listen,listxattr,llistxattr,_llseek,lremovexattr,lseek,lsetxattr,lstat,lstat64,madvise,memfd_create,mincore,mkdir,mkdirat,mknod,mknodat,mlock,mlock2,mlockall,mmap,mmap2,mprotect,mq_getsetattr,mq_notify,mq_open,mq_timedreceive,mq_timedsend,mq_unlink,mremap,msgctl,msgget,msgrcv,msgsnd,msync,munlock,munlockall,munmap,nanosleep,newfstatat,_newselect,open,openat,pause,personality,personality,personality,pipe,pipe2,poll,ppoll,prctl,pread64,preadv,prlimit64,pselect6,pwrite64,pwritev,read,readahead,readlink,readlinkat,readv,recv,recvfrom,recvmmsg,recvmsg,remap_file_pages,removexattr,rename,renameat,renameat2,restart_syscall,rmdir,rt_sigaction,rt_sigpending,rt_sigprocmask,rt_sigqueueinfo,rt_sigreturn,rt_sigsuspend,rt_sigtimedwait,rt_tgsigqueueinfo,sched_getaffinity,sched_getattr,sched_getparam,sched_get_priority_max,sched_get_priority_min,sched_getscheduler,sched_rr_get_interval,sched_setaffinity,sched_setattr,sched_setparam,sched_setscheduler,sched_yield,seccomp,select,semctl,semget,semop,semtimedop,send,sendfile,sendfile64,sendmmsg,sendmsg,sendto,setdomainname,setfsgid,setfsgid32,setfsuid,setfsuid32,setgid,setgid32,setgroups,setgroups32,sethostname,setitimer,setpgid,setpriority,setregid,setregid32,setresgid,setresgid32,setresuid,setresuid32,setreuid,setreuid32,setrlimit,set_robust_list,setsid,setsockopt,set_thread_area,set_tid_address,setuid,setuid32,setxattr,shmat,shmctl,shmdt,shmget,shutdown,sigaltstack,signalfd,signalfd4,sigreturn,socket,socketpair,splice,stat,stat64,statfs,statfs64,symlink,symlinkat,sync,sync_file_range,syncfs,sysinfo,syslog,tee,tgkill,time,timer_create,timer_delete,timerfd_create,timerfd_gettime,timerfd_settime,timer_getoverrun,timer_gettime,timer_settime,times,tkill,truncate,truncate64,ugetrlimit,umask,uname,unlink,unlinkat,utime,utimensat,utimes,vfork,vhangup,vmsplice,wait4,waitid,waitpid,write,writev,modify_ldt,breakpoint,cacheflush,set_tls

rlimit-fsize 524288000 #500Mb
rlimit-nproc 200
rlimit-nofile 100