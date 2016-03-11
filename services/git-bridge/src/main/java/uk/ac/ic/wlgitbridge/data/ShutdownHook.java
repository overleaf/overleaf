package uk.ac.ic.wlgitbridge.data;

import uk.ac.ic.wlgitbridge.util.Log;

/**
 * Created by Winston on 21/02/15.
 */
public class ShutdownHook extends Thread implements LockAllWaiter {

    private final ProjectLock projectLock;

    public ShutdownHook(ProjectLock projectLock) {
        this.projectLock = projectLock;
        projectLock.setWaiter(this);
    }

    @Override
    public void run() {
        Log.info("Shutdown received.");
        projectLock.lockAll();
        Log.info("No projects to wait for.");
        Log.info("Bye");
    }

    @Override
    public void threadsRemaining(int threads) {
        Log.info("Waiting for " + threads + " projects...");
    }

}
