package uk.ac.ic.wlgitbridge.data;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 20/11/14.
 */
public class ProjectLockImpl implements ProjectLock {

  private final Map<String, Lock> projectLocks;
  private final ReentrantReadWriteLock rwlock;
  private final Lock rlock;
  private final ReentrantReadWriteLock.WriteLock wlock;
  private LockAllWaiter waiter;
  private boolean waiting;

  public ProjectLockImpl() {
    projectLocks = new HashMap<String, Lock>();
    rwlock = new ReentrantReadWriteLock();
    rlock = rwlock.readLock();
    wlock = rwlock.writeLock();
    waiting = false;
  }

  public ProjectLockImpl(LockAllWaiter waiter) {
    this();
    setWaiter(waiter);
  }

  @Override
  public void lockForProject(String projectName) throws CannotAcquireLockException {
    Log.debug("[{}] taking project lock", projectName);
    Lock projectLock = getLockForProjectName(projectName);
    try {
      if (!projectLock.tryLock(5, TimeUnit.SECONDS)) {
        Log.debug("[{}] failed to acquire project lock", projectName);
        throw new CannotAcquireLockException();
      }
    } catch (InterruptedException e) {
      throw new RuntimeException(e);
    }
    Log.debug("[{}] taking reentrant lock", projectName);
    rlock.lock();
    Log.debug("[{}] taken locks", projectName);
  }

  @Override
  public void unlockForProject(String projectName) {
    Log.debug("[{}] releasing project lock", projectName);
    getLockForProjectName(projectName).unlock();
    Log.debug("[{}] releasing reentrant lock", projectName);
    rlock.unlock();
    Log.debug("[{}] released locks", projectName);
    if (waiting) {
      Log.debug("[{}] waiting for remaining threads", projectName);
      trySignal();
    }
  }

  private void trySignal() {
    int threads = rwlock.getReadLockCount();
    Log.debug("-> waiting for {} threads", threads);
    if (waiter != null && threads > 0) {
      waiter.threadsRemaining(threads);
    }
    Log.debug("-> finished waiting for threads");
  }

  public void lockAll() {
    Log.debug("-> locking all threads");
    waiting = true;
    trySignal();
    Log.debug("-> locking reentrant write lock");
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
