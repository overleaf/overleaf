package uk.ac.ic.wlgitbridge.bridge.swap.job;

import com.google.api.client.repackaged.com.google.common.base.Preconditions;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.LockGuard;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.TimerUtils;

import java.io.IOException;
import java.io.InputStream;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Timer;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Created by winston on 20/08/2016.
 */
public class SwapJobImpl implements SwapJob {

    private static final long GiB = (1l << 30);

    int minProjects;
    long lowWatermarkBytes;
    long highWatermarkBytes;
    Duration interval;

    private final ProjectLock lock;
    private final RepoStore repoStore;
    private final DBStore dbStore;
    private final SwapStore swapStore;

    private final Timer timer;

    final AtomicInteger swaps;

    public SwapJobImpl(
            SwapJobConfig cfg,
            ProjectLock lock,
            RepoStore repoStore,
            DBStore dbStore,
            SwapStore swapStore
    ) {
        this(
                cfg.getMinProjects(),
                GiB * cfg.getLowGiB(),
                GiB * cfg.getHighGiB(),
                Duration.ofMillis(cfg.getIntervalMillis()),
                lock,
                repoStore,
                dbStore,
                swapStore
        );
    }

    SwapJobImpl(
            int minProjects,
            long lowWatermarkBytes,
            long highWatermarkBytes,
            Duration interval,
            ProjectLock lock,
            RepoStore repoStore,
            DBStore dbStore,
            SwapStore swapStore
    ) {
        this.minProjects = minProjects;
        this.lowWatermarkBytes = lowWatermarkBytes;
        this.highWatermarkBytes = highWatermarkBytes;
        this.interval = interval;
        this.lock = lock;
        this.repoStore = repoStore;
        this.dbStore = dbStore;
        this.swapStore = swapStore;
        timer = new Timer();
        swaps = new AtomicInteger(0);
    }

    @Override
    public void start() {
        timer.schedule(
                TimerUtils.makeTimerTask(this::doSwap),
                0
        );
    }

    @Override
    public void stop() {
        timer.cancel();
    }

    private void doSwap() {
        try {
            doSwap_();
        } catch (Throwable t) {
            Log.warn("Exception thrown during swap job", t);
        }
        timer.schedule(
                TimerUtils.makeTimerTask(this::doSwap),
                interval.toMillis()
        );
    }

    private void doSwap_() {
        Log.info("Running swap number {}", swaps.get() + 1);
        long totalSize = repoStore.totalSize();
        Log.info("Size is {}/{} (high)", totalSize, highWatermarkBytes);
        if (totalSize < highWatermarkBytes) {
            Log.info("No need to swap.");
            swaps.incrementAndGet();
            return;
        }
        int numProjects = dbStore.getNumProjects();
        while (
                (totalSize = repoStore.totalSize()) > lowWatermarkBytes &&
                (numProjects = dbStore.getNumUnswappedProjects()) > minProjects
        ) {
            String projectName = dbStore.getOldestUnswappedProject();
            try {
                evict(projectName);
            } catch (IOException e) {
                Log.warn("[{}] Exception while swapping, giving up", projectName, e);
            }
        }
        if (totalSize > lowWatermarkBytes) {
            Log.warn(
                    "Finished swapping, but total size is still too high."
            );
        }
        Log.info(
                "Size: {}/{} (low), " +
                        "{} (high), " +
                        "projects on disk: {}/{}, " +
                        "min projects on disk: {}",
                totalSize,
                lowWatermarkBytes,
                highWatermarkBytes,
                numProjects,
                dbStore.getNumProjects(),
                minProjects
        );
        swaps.incrementAndGet();
    }

    /**
     * @see SwapJob#evict(String) for high-level description.
     *
     * 1. Acquires the project lock.
     * 2. Gets a bz2 stream and size of a project from the repo store, or throws
     * 3. Uploads the bz2 stream and size to the projName in the swapStore.
     * 4. Sets the last accessed time in the dbStore to null, which makes our
     *    state SWAPPED
     * 5. Removes the project from the repo store.
     * @param projName
     * @throws IOException
     */
    @Override
    public void evict(String projName) throws IOException {
        Preconditions.checkNotNull(projName, "projName was null");
        Log.info("Evicting project: {}", projName);
        try (LockGuard __ = lock.lockGuard(projName)) {
            repoStore.gcProject(projName);
            long[] sizePtr = new long[1];
            try (InputStream blob = repoStore.bzip2Project(projName, sizePtr)) {
                swapStore.upload(projName, blob, sizePtr[0]);
                dbStore.setLastAccessedTime(projName, null);
                repoStore.remove(projName);
            }
        }
        Log.info("Evicted project: {}", projName);
    }

    /**
     * @see SwapJob#restore(String) for high-level description.
     *
     * 1. Acquires the project lock.
     * 2. Gets a bz2 stream for the project from the swapStore.
     * 3. Fully downloads and places the bz2 stream back in the repo store.
     * 4. Sets the last accessed time in the dbStore to now, which makes our
     *    state PRESENT and the last project to be evicted.
     * @param projName
     * @throws IOException
     */
    @Override
    public void restore(String projName) throws IOException {
        try (LockGuard __ = lock.lockGuard(projName)) {
            try (InputStream zipped = swapStore.openDownloadStream(projName)) {
                repoStore.unbzip2Project(
                        projName,
                        zipped
                );
                swapStore.remove(projName);
                dbStore.setLastAccessedTime(
                        projName,
                        Timestamp.valueOf(LocalDateTime.now())
                );
            }
        }
    }

}
