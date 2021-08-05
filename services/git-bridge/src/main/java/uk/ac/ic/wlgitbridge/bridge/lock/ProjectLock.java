package uk.ac.ic.wlgitbridge.bridge.lock;

/**
 * Project Lock class.
 *
 * The locks should be re-entrant. For example, we are usually holding the lock
 * when a project must be restored, which tries to acquire the lock again.
 */
public interface ProjectLock {

    void lockAll();

    void lockForProject(String projectName);

    void unlockForProject(String projectName);

    /* RAII hahaha */
    default LockGuard lockGuard(String projectName) {
        lockForProject(projectName);
        return () -> unlockForProject(projectName);
    }

}
