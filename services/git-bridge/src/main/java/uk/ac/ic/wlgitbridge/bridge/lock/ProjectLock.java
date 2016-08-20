package uk.ac.ic.wlgitbridge.bridge.lock;

/**
 * Created by winston on 20/08/2016.
 */
public interface ProjectLock {
    void lockAll();

    void lockForProject(String projectName);

    void unlockForProject(String projectName);
}
