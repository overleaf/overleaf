package uk.ac.ic.wlgitbridge.bridge.swap;

import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.util.Log;

import java.time.Duration;
import java.util.Timer;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Created by winston on 20/08/2016.
 */
public class SwapJobImpl implements SwapJob {

    private final ProjectLock lock;
    private final RepoStore repoStore;
    private final SwapStore swapStore;
    private final DBStore dbStore;

    private final Timer timer;

    final AtomicInteger swaps;

    public SwapJobImpl(
            ProjectLock lock,
            RepoStore repoStore,
            DBStore dbStore,
            SwapStore swapStore
    ) {

        this.lock = lock;
        this.repoStore = repoStore;
        this.swapStore = swapStore;
        this.dbStore = dbStore;
        timer = new Timer();
        swaps = new AtomicInteger(0);
    }

    @Override
    public void start(Duration interval) {
        timer.scheduleAtFixedRate(
                uk.ac.ic.wlgitbridge.util.Timer.makeTimerTask(this::doSwap),
                0,
                interval.toMillis()
        );
    }

    @Override
    public void stop() {
        timer.cancel();
    }

    private void doSwap() {
        Log.info("Running {}th swap", swaps.getAndIncrement());

    }

}
