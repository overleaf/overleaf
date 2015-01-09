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
        getLockForProjectName(projectName).lock();
    }

    public void unlockForProject(String projectName) {
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
