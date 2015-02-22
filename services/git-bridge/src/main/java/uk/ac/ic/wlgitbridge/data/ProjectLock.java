package uk.ac.ic.wlgitbridge.data;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Created by Winston on 20/11/14.
 */
public class ProjectLock {

    private final Map<String, Lock> projectLocks;
    private final ReentrantReadWriteLock rwlock;
    private final Lock rlock;
    private final ReentrantReadWriteLock.WriteLock wlock;
    private LockAllWaiter waiter;
    private boolean waiting;

    public ProjectLock() {
        projectLocks = new HashMap<String, Lock>();
        rwlock = new ReentrantReadWriteLock();
        rlock = rwlock.readLock();
        wlock = rwlock.writeLock();
        waiting = false;
    }

    public void lockForProject(String projectName) {
        getLockForProjectName(projectName).lock();
        rlock.lock();
    }

    public void unlockForProject(String projectName) {
        getLockForProjectName(projectName).unlock();
        rlock.unlock();
        if (waiting) {
            trySignal();
        }
    }

    private void trySignal() {
        int threads = rwlock.getReadLockCount();
        if (waiter != null && threads > 0) {
            waiter.threadsRemaining(threads);
        }
    }

    public void lockAll() {
        waiting = true;
        trySignal();
        wlock.lock();
    }

    private synchronized Lock getLockForProjectName(String projectName) {
        Lock lock = projectLocks.get(projectName);
        if (lock == null) {
            lock = new ReentrantLock();
            projectLocks.put(projectName, lock);
        }
        return lock;
    }

    public void setWaiter(LockAllWaiter waiter) {
        this.waiter = waiter;
    }

}
