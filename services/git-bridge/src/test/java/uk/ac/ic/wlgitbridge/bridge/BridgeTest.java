package uk.ac.ic.wlgitbridge.bridge;

import org.junit.Before;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.resource.ResourceCache;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotAPI;
import uk.ac.ic.wlgitbridge.bridge.swap.SwapJob;
import uk.ac.ic.wlgitbridge.bridge.swap.SwapStore;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

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

    @Before
    public void setup() {
        lock = mock(ProjectLock.class);
        repoStore = mock(RepoStore.class);
        dbStore = mock(DBStore.class);
        swapStore = mock(SwapStore.class);
        snapshotAPI = mock(SnapshotAPI.class);
        swapJob = mock(SwapJob.class);
        bridge = new Bridge(
                lock,
                repoStore,
                dbStore,
                swapStore,
                snapshotAPI,
                resourceCache,
                swapJob
        );
    }

    @Test
    public void shutdownStopsSwapJob() {
        bridge.startSwapJob(1000);
        bridge.doShutdown();
        verify(swapJob).start(1000);
        verify(swapJob).stop();
    }

}