package uk.ac.ic.wlgitbridge.bridge;

import org.junit.Before;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.db.ProjectState;
import uk.ac.ic.wlgitbridge.bridge.gc.GcJob;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.ProjectRepo;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.resource.ResourceCache;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotAPI;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJob;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
import uk.ac.ic.wlgitbridge.data.model.Snapshot;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;

import java.io.IOException;
import java.util.ArrayDeque;

import static org.mockito.Matchers.any;
import static org.mockito.Matchers.anyInt;
import static org.mockito.Matchers.eq;
import static org.mockito.Mockito.*;

/**
 * Created by winston on 20/08/2016.
 */
public class BridgeTest {

    private Bridge bridge;

    private ProjectLock lock;
    private RepoStore repoStore;
    private DBStore dbStore;
    private SwapStore swapStore;
    private SnapshotAPI snapshotAPI;
    private ResourceCache resourceCache;
    private SwapJob swapJob;
    private GcJob gcJob;

    @Before
    public void setup() {
        lock = mock(ProjectLock.class);
        repoStore = mock(RepoStore.class);
        dbStore = mock(DBStore.class);
        swapStore = mock(SwapStore.class);
        snapshotAPI = mock(SnapshotAPI.class);
        resourceCache = mock(ResourceCache.class);
        swapJob = mock(SwapJob.class);
        gcJob = mock(GcJob.class);
        bridge = new Bridge(
                lock,
                repoStore,
                dbStore,
                swapStore,
                swapJob,
                gcJob,
                snapshotAPI,
                resourceCache
        );
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
    public void updatingRepositorySetsLastAccessedTime(
    ) throws IOException, GitUserException {
        ProjectRepo repo = mock(ProjectRepo.class);
        when(repo.getProjectName()).thenReturn("asdf");
        when(dbStore.getProjectState("asdf")).thenReturn(ProjectState.PRESENT);
        when(
                snapshotAPI.getSnapshotsForProjectAfterVersion(
                        any(),
                        any(),
                        anyInt()
                )
        ).thenReturn(new ArrayDeque<Snapshot>());
        bridge.updateRepository(null, repo);
        verify(dbStore).setLastAccessedTime(eq("asdf"), any());
    }

}