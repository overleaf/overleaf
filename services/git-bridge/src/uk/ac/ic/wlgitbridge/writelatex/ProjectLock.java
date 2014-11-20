package uk.ac.ic.wlgitbridge.writelatex;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Created by Winston on 20/11/14.
 */
public class ProjectLock {

    private final Map<String, Lock> projectLocks;

    public ProjectLock() {
        projectLocks = new HashMap<String, Lock>();
    }

    public void lockForProject(String projectName) {
        System.out.println("Locking for: " + Thread.currentThread().getId());
        getLockForProjectName(projectName).lock();
    }

    public void unlockForProject(String projectName) {
        System.out.println("Unlocking for: " + Thread.currentThread().getId());
        getLockForProjectName(projectName).unlock();
    }

    private synchronized Lock getLockForProjectName(String projectName) {
        Lock lock = projectLocks.get(projectName);
        if (lock == null) {
            lock = new ReentrantLock();
            projectLocks.put(projectName, lock);
        }
        return lock;
    }

}
