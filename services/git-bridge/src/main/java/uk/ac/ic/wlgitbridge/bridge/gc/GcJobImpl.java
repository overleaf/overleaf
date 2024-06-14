package uk.ac.ic.wlgitbridge.bridge.gc;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import uk.ac.ic.wlgitbridge.bridge.lock.LockGuard;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.ProjectRepo;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.data.CannotAcquireLockException;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.TimerUtils;

/*
 * Implementation of {@link GcJob} using its own Timer and a synchronized
 * queue.
 */
public class GcJobImpl implements GcJob {

  private final RepoStore repoStore;
  private final ProjectLock locks;

  private final long intervalMs;
  private final Timer timer;

  private final Set<String> gcQueue;

  /*
   * Hooks in case they are needed, e.g. for testing.
   */
  private AtomicReference<Runnable> preGc;
  private AtomicReference<Runnable> postGc;

  /* We need to iterate over and empty it after every run */
  private final Lock jobWaitersLock;
  private final List<CompletableFuture<Void>> jobWaiters;

  public GcJobImpl(RepoStore repoStore, ProjectLock locks, long intervalMs) {
    this.repoStore = repoStore;
    this.locks = locks;
    this.intervalMs = intervalMs;
    timer = new Timer();
    gcQueue = Collections.newSetFromMap(new ConcurrentHashMap<>());
    preGc = new AtomicReference<>(() -> {});
    postGc = new AtomicReference<>(() -> {});
    jobWaitersLock = new ReentrantLock();
    jobWaiters = new ArrayList<>();
  }

  public GcJobImpl(RepoStore repoStore, ProjectLock locks) {
    this(repoStore, locks, TimeUnit.MILLISECONDS.convert(1, TimeUnit.HOURS));
  }

  @Override
  public void start() {
    Log.info("Starting GC job to run every [{}] ms", intervalMs);
    timer.scheduleAtFixedRate(TimerUtils.makeTimerTask(this::doGC), intervalMs, intervalMs);
  }

  @Override
  public void stop() {
    Log.info("Stopping GC job");
    timer.cancel();
  }

  @Override
  public void onPreGc(Runnable preGc) {
    this.preGc.set(preGc);
  }

  @Override
  public void onPostGc(Runnable postGc) {
    this.postGc.set(postGc);
  }

  /*
   * Needs to be callable from any thread.
   * @param projectName
   */
  @Override
  public void queueForGc(String projectName) {
    gcQueue.add(projectName);
  }

  @Override
  public CompletableFuture<Void> waitForRun() {
    CompletableFuture<Void> ret = new CompletableFuture<>();
    jobWaitersLock.lock();
    try {
      jobWaiters.add(ret);
    } finally {
      jobWaitersLock.unlock();
    }
    return ret;
  }

  private void doGC() {
    Log.info("GC job running");
    int numGcs = 0;
    preGc.get().run();
    for (Iterator<String> it = gcQueue.iterator(); it.hasNext(); it.remove(), ++numGcs) {
      String proj = it.next();
      Log.debug("[{}] Running GC job on project", proj);
      try (LockGuard __ = locks.lockGuard(proj)) {
        try {
          ProjectRepo repo = repoStore.getExistingRepo(proj);
          repo.runGC();
          repo.deleteIncomingPacks();
        } catch (IOException e) {
          Log.warn("[{}] Failed to GC project", proj);
        }
      } catch (CannotAcquireLockException e) {
        Log.warn("[{}] Cannot acquire project lock, skipping GC", proj);
      }
    }
    Log.info("GC job finished, num gcs: {}", numGcs);
    jobWaitersLock.lock();
    try {
      jobWaiters.forEach(w -> w.complete(null));
    } finally {
      jobWaitersLock.unlock();
    }
    postGc.get().run();
  }
}
