package uk.ac.ic.wlgitbridge.bridge.swap.job;

import java.io.IOException;
import java.util.Optional;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by winston on 20/08/2016.
 */
public interface SwapJob {

  enum CompressionMethod {
    Bzip2,
    Gzip
  }

  static CompressionMethod stringToCompressionMethod(String compressionString) {
    if (compressionString == null) {
      return null;
    }
    CompressionMethod result;
    switch (compressionString) {
      case "gzip":
        result = CompressionMethod.Gzip;
        break;
      case "bzip2":
        result = CompressionMethod.Bzip2;
        break;
      default:
        result = null;
        break;
    }
    return result;
  }

  static String compressionMethodAsString(CompressionMethod compressionMethod) {
    if (compressionMethod == null) {
      return null;
    }
    String result;
    switch (compressionMethod) {
      case Gzip:
        result = "gzip";
        break;
      case Bzip2:
        result = "bzip2";
        break;
      default:
        result = null;
        break;
    }
    return result;
  }

  static SwapJob fromConfig(
      Optional<SwapJobConfig> cfg,
      ProjectLock lock,
      RepoStore repoStore,
      DBStore dbStore,
      SwapStore swapStore) {
    if (!cfg.isPresent()) {
      return new NoopSwapJob();
    }
    if (!swapStore.isSafe() && !cfg.get().getAllowUnsafeStores()) {
      Log.warn(
          "Swap store '{}' is not safe; disabling swap job", swapStore.getClass().getSimpleName());
      return new NoopSwapJob();
    }
    return new SwapJobImpl(cfg.get(), lock, repoStore, dbStore, swapStore);
  }

  /*
   * Starts the swap job, which should schedule an attempted swap at the given
   * configured interval (config["swapJob"]["intervalMillis"]
   */
  void start();

  /*
   * Stops the stop job.
   */
  void stop();

  /*
   * Called by the swap job when a project should be evicted.
   *
   * Pre:
   * 1. projName must be in repoStore
   * 2. projName should not be in swapStore
   * 3. projName should be PRESENT in dbStore (last_accessed is not null)
   *
   * Acquires the project lock and performs an eviction of projName.
   *
   * Post:
   * 1. projName should not in repoStore
   * 2. projName must be in swapStore
   * 3. projName must be SWAPPED in dbStore (last_accessed is null)
   * @param projName
   * @throws IOException
   */
  void evict(String projName) throws IOException;

  /*
   * Called on a project when it must be restored.
   *
   * Pre:
   * 1. projName should not be in repoStore
   * 2. projName must be in swapStore
   * 3. projName must be SWAPPED in dbStore (last_accessed is null)
   *
   * Acquires the project lock and restores projName.
   *
   * Post:
   * 1. projName must be in repoStore
   * 2. projName should not in swapStore
   * 3. projName should be PRESENT in dbStore (last_accessed is not null)
   * @param projName
   * @throws IOException
   */
  void restore(String projName) throws IOException;
}
