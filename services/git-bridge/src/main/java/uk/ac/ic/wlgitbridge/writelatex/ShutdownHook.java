package uk.ac.ic.wlgitbridge.writelatex;

import uk.ac.ic.wlgitbridge.util.Util;

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
        Util.sout("Shutdown received.");
        projectLock.lockAll();
        Util.sout("No projects to wait for.");
        Util.sout("Bye");
    }

    @Override
    public void threadsRemaining(int threads) {
        Util.sout("Waiting for " + threads + " projects...");
    }

}
