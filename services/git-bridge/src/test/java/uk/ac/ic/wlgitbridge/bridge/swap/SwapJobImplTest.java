package uk.ac.ic.wlgitbridge.bridge.swap;

import org.junit.Before;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;

import java.time.Duration;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;

/**
 * Created by winston on 20/08/2016.
 */
public class SwapJobImplTest {

    private SwapJobImpl swapJob;

    private ProjectLock lock;
    private RepoStore repoStore;
    private DBStore dbStore;
    private SwapStore swapStore;

    @Before
    public void setup() {
        lock = mock(ProjectLock.class);
        repoStore = mock(RepoStore.class);
        dbStore = mock(DBStore.class);
        swapStore = mock(SwapStore.class);
        swapJob = new SwapJobImpl(
                SwapJobConfig.DEFAULT,
                lock,
                repoStore,
                dbStore,
                swapStore
        );
    }

    @Test
    public void startingTimerAlwaysCausesASwap() {
        assertEquals(0, swapJob.swaps.get());
        swapJob.start(Duration.ofHours(1));
        while (swapJob.swaps.get() <= 0);
        assertTrue(swapJob.swaps.get() > 0);
    }

    @Test
    public void swapsHappenEveryInterval() {
        assertEquals(0, swapJob.swaps.get());
        swapJob.start(Duration.ofMillis(1));
        while (swapJob.swaps.get() <= 1);
        assertTrue(swapJob.swaps.get() > 1);
    }

}