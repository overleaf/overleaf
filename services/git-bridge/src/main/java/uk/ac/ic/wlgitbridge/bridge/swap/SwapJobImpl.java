package uk.ac.ic.wlgitbridge.bridge.swap;

import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.util.Util;

import java.util.Timer;

/**
 * Created by winston on 20/08/2016.
 */
public class SwapJobImpl implements SwapJob {

    private final ProjectLock lock;
    private final RepoStore repoStore;
    private final SwapStore swapStore;
    private final DBStore dbStore;

    private final Timer timer;

    public SwapJobImpl(
            ProjectLock lock,
            RepoStore repoStore,
            DBStore dbStore, SwapStore swapStore
    ) {

        this.lock = lock;
        this.repoStore = repoStore;
        this.swapStore = swapStore;
        this.dbStore = dbStore;
        timer = new Timer();
    }

    @Override
    public void start(int intervalMillis) {
        timer.scheduleAtFixedRate(
                Util.makeTimerTask(this::doSwap),
                0,
                intervalMillis
        );
    }

    @Override
    public void stop() {
        timer.cancel();
    }

    private void doSwap() {
        throw new UnsupportedOperationException();
    }

}
