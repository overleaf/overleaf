package uk.ac.ic.wlgitbridge.bridge;

import static org.mockito.Mockito.*;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Optional;
import org.junit.Before;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.application.config.Config;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.db.ProjectState;
import uk.ac.ic.wlgitbridge.bridge.gc.GcJob;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.ProjectRepo;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.resource.ResourceCache;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotApiFacade;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJob;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
import uk.ac.ic.wlgitbridge.data.CannotAcquireLockException;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocResult;

/*
 * Created by winston on 20/08/2016.
 */
public class BridgeTest {

  private Bridge bridge;

  private ProjectLock lock;
  private RepoStore repoStore;
  private DBStore dbStore;
  private SwapStore swapStore;
  private SnapshotApiFacade snapshotAPI;
  private ResourceCache resourceCache;
  private SwapJob swapJob;
  private GcJob gcJob;

  @Before
  public void setup() {
    lock = mock(ProjectLock.class);
    repoStore = mock(RepoStore.class);
    dbStore = mock(DBStore.class);
    swapStore = mock(SwapStore.class);
    snapshotAPI = mock(SnapshotApiFacade.class);
    resourceCache = mock(ResourceCache.class);
    swapJob = mock(SwapJob.class);
    gcJob = mock(GcJob.class);
    bridge =
        new Bridge(
            new Config(0, "", 0, "", null, "", "", "", null, false, null, null, null, 0),
            lock,
            repoStore,
            dbStore,
            swapStore,
            swapJob,
            gcJob,
            snapshotAPI,
            resourceCache);
  }

  @Test
  public void shutdownStopsSwapAndGcJobs() {
    bridge.startBackgroundJobs();
    verify(swapJob).start();
    verify(gcJob).start();
    bridge.doShutdown();
    verify(swapJob).stop();
    verify(gcJob).stop();
  }

  @Test
  public void updatingRepositorySetsLastAccessedTime()
      throws IOException, GitUserException, CannotAcquireLockException {
    ProjectRepo repo = mock(ProjectRepo.class);
    when(repoStore.getExistingRepo("asdf")).thenReturn(repo);
    when(dbStore.getProjectState("asdf")).thenReturn(ProjectState.PRESENT);
    when(snapshotAPI.projectExists(Optional.empty(), "asdf")).thenReturn(true);
    when(snapshotAPI.getDoc(Optional.empty(), "asdf"))
        .thenReturn(Optional.of(mock(GetDocResult.class)));
    when(snapshotAPI.getSnapshots(any(), any(), anyInt())).thenReturn(new ArrayDeque<>());
    bridge.getUpdatedRepo(Optional.empty(), "asdf");
    verify(dbStore).setLastAccessedTime(eq("asdf"), any());
  }
}
