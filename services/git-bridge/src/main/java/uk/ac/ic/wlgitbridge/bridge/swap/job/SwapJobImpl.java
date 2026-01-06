package uk.ac.ic.wlgitbridge.bridge.swap.job;

import com.google.api.client.repackaged.com.google.common.base.Preconditions;
import java.io.IOException;
import java.io.InputStream;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Timer;
import java.util.concurrent.atomic.AtomicInteger;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.LockGuard;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
import uk.ac.ic.wlgitbridge.data.CannotAcquireLockException;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.TimerUtils;

/*
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
  private final CompressionMethod compressionMethod;

  private final Timer timer;

  final AtomicInteger swaps;

  public SwapJobImpl(
      SwapJobConfig cfg,
      ProjectLock lock,
      RepoStore repoStore,
      DBStore dbStore,
      SwapStore swapStore) {
    this(
        cfg.getMinProjects(),
        GiB * cfg.getLowGiB(),
        GiB * cfg.getHighGiB(),
        Duration.ofMillis(cfg.getIntervalMillis()),
        cfg.getCompressionMethod(),
        lock,
        repoStore,
        dbStore,
        swapStore);
  }

  SwapJobImpl(
      int minProjects,
      long lowWatermarkBytes,
      long highWatermarkBytes,
      Duration interval,
      CompressionMethod method,
      ProjectLock lock,
      RepoStore repoStore,
      DBStore dbStore,
      SwapStore swapStore) {
    this.minProjects = minProjects;
    this.lowWatermarkBytes = lowWatermarkBytes;
    this.highWatermarkBytes = highWatermarkBytes;
    this.interval = interval;
    this.compressionMethod = method;
    this.lock = lock;
    this.repoStore = repoStore;
    this.dbStore = dbStore;
    this.swapStore = swapStore;
    timer = new Timer();
    swaps = new AtomicInteger(0);
  }

  @Override
  public void start() {
    timer.schedule(TimerUtils.makeTimerTask(this::doSwap), 0);
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
    timer.schedule(TimerUtils.makeTimerTask(this::doSwap), interval.toMillis());
  }

  private void doSwap_() {
    ArrayList<String> exceptionProjectNames = new ArrayList<String>();

    Log.debug("Running swap number {}", swaps.get() + 1);
    long totalSize = repoStore.totalSize();
    Log.debug("Size is {}/{} (high)", totalSize, highWatermarkBytes);
    if (totalSize < highWatermarkBytes) {
      Log.debug("No need to swap.");
      swaps.incrementAndGet();
      return;
    }
    int numProjects = dbStore.getNumProjects();
    // while we have too many projects on disk
    while ((totalSize = repoStore.totalSize()) > lowWatermarkBytes
        && (numProjects = dbStore.getNumUnswappedProjects()) > minProjects) {
      // check if we've had too many exceptions so far
      if (exceptionProjectNames.size() >= 20) {
        StringBuilder sb = new StringBuilder();
        for (String s : exceptionProjectNames) {
          sb.append(s);
          sb.append(' ');
        }
        Log.error(
            "Too many exceptions while running swap, giving up on this run: {}", sb.toString());
        break;
      }
      // get the oldest project and try to swap it
      String projectName = dbStore.getOldestUnswappedProject();
      try {
        evict(projectName);
      } catch (Exception e) {
        Log.warn("[{}] Exception while swapping, mark project and move on", projectName, e);
        // NOTE: this is something of a hack. If a project fails to swap we get stuck in a
        // loop where `dbStore.getOldestUnswappedProject()` gives the same failing project over and
        // over again,
        // which fills up the disk with errors. By touching the access time we can mark the project
        // as a
        // non-candidate for swapping. Ideally we should be checking the logs for these log events
        // and fixing
        // whatever is wrong with the project
        dbStore.setLastAccessedTime(projectName, Timestamp.valueOf(LocalDateTime.now()));
        exceptionProjectNames.add(projectName);
      }
    }
    if (lowWatermarkBytes > 0 && totalSize > lowWatermarkBytes) {
      // NOTE: If lowWatermarkBytes is 0, we never expect to reach it (since
      // we keep the repo database on disk), so don't log a warning.
      Log.warn("Finished swapping, but total size is still too high.");
    }
    Log.debug(
        "Size: {}/{} (low), "
            + "{} (high), "
            + "projects on disk: {}/{}, "
            + "min projects on disk: {}",
        totalSize,
        lowWatermarkBytes,
        highWatermarkBytes,
        numProjects,
        dbStore.getNumProjects(),
        minProjects);
    swaps.incrementAndGet();
  }

  /*
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
      try {
        repoStore.gcProject(projName);
      } catch (Exception e) {
        Log.error("[{}] Exception while running gc on project: {}", projName, e);
      }
      long[] sizePtr = new long[1];
      try (InputStream blob = getBlobStream(projName, sizePtr)) {
        swapStore.upload(projName, blob, sizePtr[0]);
        String compression = SwapJob.compressionMethodAsString(compressionMethod);
        if (compression == null) {
          throw new RuntimeException("invalid compression method, should not happen");
        }
        dbStore.swap(projName, compression);
        repoStore.remove(projName);
      }
    } catch (CannotAcquireLockException e) {
      Log.warn("[{}] Cannot acquire project lock, skipping swap", projName);
      return;
    }
    Log.info("Evicted project: {}", projName);
  }

  private InputStream getBlobStream(String projName, long[] sizePtr) throws IOException {
    if (compressionMethod == CompressionMethod.Gzip) {
      return repoStore.gzipProject(projName, sizePtr);
    } else if (compressionMethod == CompressionMethod.Bzip2) {
      return repoStore.bzip2Project(projName, sizePtr);
    } else {
      throw new RuntimeException("invalid compression method, should not happen");
    }
  }

  /*
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
        String compression = dbStore.getSwapCompression(projName);
        if (compression == null) {
          throw new RuntimeException(
              "Missing compression method during restore, should not happen");
        }
        if ("gzip".equals(compression)) {
          repoStore.ungzipProject(projName, zipped);
        } else if ("bzip2".equals(compression)) {
          repoStore.unbzip2Project(projName, zipped);
        }
        swapStore.remove(projName);
        dbStore.restore(projName);
      }
    } catch (CannotAcquireLockException e) {
      throw new RuntimeException(e);
    }
  }
}
