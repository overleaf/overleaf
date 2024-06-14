package uk.ac.ic.wlgitbridge.bridge.swap.job;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.apache.commons.io.FileUtils;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SqliteDBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.FSGitRepoStore;
import uk.ac.ic.wlgitbridge.bridge.repo.FSGitRepoStoreTest;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.swap.store.InMemorySwapStore;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
import uk.ac.ic.wlgitbridge.data.ProjectLockImpl;

/*
 * Created by winston on 20/08/2016.
 */
public class SwapJobImplTest {

  private SwapJobImpl swapJob;

  private ProjectLock lock;
  private RepoStore repoStore;
  private DBStore dbStore;
  private SwapStore swapStore;

  @Before
  public void setup() throws IOException {
    TemporaryFolder tmpFolder = new TemporaryFolder();
    tmpFolder.create();
    lock = new ProjectLockImpl();
    repoStore =
        new FSGitRepoStore(
            FSGitRepoStoreTest.makeTempRepoDir(tmpFolder, "repostore").getAbsolutePath(),
            100_000,
            FileUtils::sizeOfDirectory);
    dbStore = new SqliteDBStore(tmpFolder.newFile());
    dbStore.setLatestVersionForProject("proj1", 0);
    dbStore.setLatestVersionForProject("proj2", 0);
    dbStore.setLastAccessedTime("proj1", Timestamp.valueOf(LocalDateTime.now()));
    dbStore.setLastAccessedTime(
        "proj2", Timestamp.valueOf(LocalDateTime.now().minus(1, ChronoUnit.SECONDS)));
    swapStore = new InMemorySwapStore();
    swapJob =
        new SwapJobImpl(
            1,
            15000,
            30000,
            Duration.ofMillis(100),
            SwapJob.CompressionMethod.Bzip2,
            lock,
            repoStore,
            dbStore,
            swapStore);
  }

  @After
  public void teardown() {
    if (swapJob != null) {
      swapJob.stop();
    }
  }

  private void waitASecond() {
    try {
      Thread.sleep(1 * 1000);
    } catch (Exception _e) {
    }
  }

  @Test
  public void startingTimerAlwaysCausesASwap() {
    swapJob.lowWatermarkBytes = 16384;
    swapJob.interval = Duration.ofHours(1);
    assertEquals(0, swapJob.swaps.get());
    swapJob.start();
    do {
      waitASecond();
    } while (swapJob.swaps.get() <= 0);
    assertTrue(swapJob.swaps.get() > 0);
  }

  @Test
  public void swapsHappenEveryInterval() {
    swapJob.lowWatermarkBytes = 16384;
    assertEquals(0, swapJob.swaps.get());
    swapJob.start();
    do {
      waitASecond();
    } while (swapJob.swaps.get() <= 1);
    assertTrue(swapJob.swaps.get() > 1);
  }

  @Test
  public void noProjectsGetSwappedWhenUnderHighWatermark() {
    swapJob.highWatermarkBytes = 65536;
    assertEquals(2, dbStore.getNumUnswappedProjects());
    swapJob.start();
    do {
      waitASecond();
    } while (swapJob.swaps.get() < 1);
    assertEquals(2, dbStore.getNumUnswappedProjects());
  }

  @Test
  public void correctProjGetSwappedWhenOverHighWatermark() throws IOException {
    swapJob.lowWatermarkBytes = 16384;
    assertEquals(2, dbStore.getNumUnswappedProjects());
    assertEquals("proj2", dbStore.getOldestUnswappedProject());
    swapJob.start();
    do {
      waitASecond();
    } while (swapJob.swaps.get() < 1);
    assertEquals(1, dbStore.getNumUnswappedProjects());
    assertEquals("proj1", dbStore.getOldestUnswappedProject());
    assertEquals("bzip2", dbStore.getSwapCompression("proj2"));
    swapJob.restore("proj2");
    assertEquals(null, dbStore.getSwapCompression("proj2"));
    int numSwaps = swapJob.swaps.get();
    do {
      waitASecond();
    } while (swapJob.swaps.get() <= numSwaps);
    assertEquals(1, dbStore.getNumUnswappedProjects());
    assertEquals("proj2", dbStore.getOldestUnswappedProject());
  }

  @Test
  public void swapCompressionGzip() throws IOException {
    swapJob =
        new SwapJobImpl(
            1,
            15000,
            30000,
            Duration.ofMillis(100),
            SwapJob.CompressionMethod.Gzip,
            lock,
            repoStore,
            dbStore,
            swapStore);
    swapJob.lowWatermarkBytes = 16384;
    assertEquals(2, dbStore.getNumUnswappedProjects());
    assertEquals("proj2", dbStore.getOldestUnswappedProject());
    swapJob.start();
    do {
      waitASecond();
    } while (swapJob.swaps.get() < 1);
    assertEquals(1, dbStore.getNumUnswappedProjects());
    assertEquals("proj1", dbStore.getOldestUnswappedProject());
    assertEquals("gzip", dbStore.getSwapCompression("proj2"));
    swapJob.restore("proj2");
    assertEquals(null, dbStore.getSwapCompression("proj2"));
    int numSwaps = swapJob.swaps.get();
    do {
      waitASecond();
    } while (swapJob.swaps.get() <= numSwaps);
    assertEquals(1, dbStore.getNumUnswappedProjects());
    assertEquals("proj2", dbStore.getOldestUnswappedProject());
  }
}
