package uk.ac.ic.wlgitbridge.bridge.gc;

import java.util.concurrent.CompletableFuture;

/*
 * Is started by the bridge. Every time a project is updated, we queue it for
 * GC which executes every hour or so.
 *
 * We don't queue it into a more immediate Executor because there is no way to
 * know if a call to {@link Bridge#updateProject(Optional, ProjectRepo)},
 * which releases the lock, is going to call
 * {@link Bridge#push(Optional, String, RawDirectory, RawDirectory, String)}.
 *
 * We don't want the GC to run in between an update and a push.
 */
public interface GcJob {

  void start();

  void stop();

  void onPreGc(Runnable preGc);

  void onPostGc(Runnable postGc);

  void queueForGc(String projectName);

  CompletableFuture<Void> waitForRun();
}
