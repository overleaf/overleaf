package uk.ac.ic.wlgitbridge.bridge.swap.job;

import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;

import java.io.IOException;
import java.util.Optional;

/**
 * Created by winston on 20/08/2016.
 */
public interface SwapJob {

    static SwapJob fromConfig(
            Optional<SwapJobConfig> cfg,
            ProjectLock lock,
            RepoStore repoStore,
            DBStore dbStore,
            SwapStore swapStore
    ) {
        if (cfg.isPresent()) {
            return new SwapJobImpl(
                    cfg.get(),
                    lock,
                    repoStore,
                    dbStore,
                    swapStore
            );
        }
        return new NoopSwapJob();
    }

    void start();

    void stop();

    void evict(String projName) throws IOException;

    void restore(String projName) throws IOException;
}
