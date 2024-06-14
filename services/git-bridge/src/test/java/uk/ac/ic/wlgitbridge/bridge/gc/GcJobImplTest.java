package uk.ac.ic.wlgitbridge.bridge.gc;

import static org.junit.Assert.assertFalse;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.stubbing.OngoingStubbing;
import uk.ac.ic.wlgitbridge.bridge.lock.LockGuard;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.ProjectRepo;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.data.CannotAcquireLockException;
import uk.ac.ic.wlgitbridge.data.ProjectLockImpl;

/*
 * Created by winston on 16/02/2017.
 */
public class GcJobImplTest {

  RepoStore repoStore = mock(RepoStore.class);

  ProjectLock locks;

  GcJobImpl gcJob;

  @Before
  public void setup() {
    locks = new ProjectLockImpl();
    gcJob = new GcJobImpl(repoStore, locks, 5);
  }

  @After
  public void teardown() {
    gcJob.stop();
  }

  @Test
  public void addedProjectsAreAllEventuallyGcedOnce() throws Exception {
    int numProjects = 5;
    /* Make the mocks, make expectations, and keep a reference to them */
    final OngoingStubbing<ProjectRepo>[] o =
        new OngoingStubbing[] {when(repoStore.getExistingRepo(anyString()))};
    List<ProjectRepo> mockRepos =
        IntStream.range(0, numProjects)
            .mapToObj(i -> String.valueOf((char) ('a' + i)))
            .map(
                proj -> {
                  gcJob.queueForGc(proj);
                  ProjectRepo mockRepo = mock(ProjectRepo.class);
                  o[0] = o[0].thenReturn(mockRepo);
                  return mockRepo;
                })
            .collect(Collectors.toList());
    CompletableFuture<Void> fut = gcJob.waitForRun();
    gcJob.start();
    fut.join();
    for (ProjectRepo mock : mockRepos) {
      verify(mock).runGC();
      verify(mock).deleteIncomingPacks();
    }
    /* Nothing should happen on the next run */
    when(repoStore.getExistingRepo(anyString())).thenThrow(new IllegalStateException());
    gcJob.waitForRun().join();
  }

  @Test
  public void cannotOverlapGcRuns() throws Exception {
    CompletableFuture<Void> runningForever = new CompletableFuture<>();
    gcJob.onPostGc(
        () -> {
          try {
            /* Pretend the GC is taking forever */
            runningForever.join();
          } catch (Throwable e) {
            runningForever.completeExceptionally(e);
          }
        });
    CompletableFuture<Void> fut = gcJob.waitForRun();
    gcJob.start();
    fut.join();
    CompletableFuture<Void> ranAgain = new CompletableFuture<>();
    gcJob.onPreGc(() -> ranAgain.complete(null));
    /* Should not run again any time soon */
    for (int i = 0; i < 50; ++i) {
      assertFalse(ranAgain.isDone());
      /* The gc interval is 5 ms, so 50 1ms sleeps should be more than
      enough without making the test slow */
      Thread.sleep(1);
    }
    assertFalse(runningForever.isCompletedExceptionally());
  }

  @Test
  public void willNotGcProjectUntilItIsUnlocked() throws InterruptedException, IOException {
    ProjectRepo repo = mock(ProjectRepo.class);
    when(repoStore.getExistingRepo(anyString())).thenReturn(repo);
    gcJob.onPostGc(gcJob::stop);
    gcJob.queueForGc("a");
    CompletableFuture<Void> fut = gcJob.waitForRun();
    try (LockGuard __ = locks.lockGuard("a")) {
      gcJob.start();
      for (int i = 0; i < 50; ++i) {
        assertFalse(fut.isDone());
        Thread.sleep(1);
      }
    } catch (CannotAcquireLockException e) {
      throw new RuntimeException(e);
    }
    /* Now that we've released the lock, fut should complete */
    fut.join();
  }
}
