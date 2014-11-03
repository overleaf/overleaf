package uk.ac.ic.wlgitbridge.writelatex;

import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public class SnapshotRepositoryBuilder implements RepositoryBuilder {

    private SnapshotDBAPI snapshotDBAPI;
    private SnapshotAPI snapshotAPI;

    public SnapshotRepositoryBuilder() {
        snapshotDBAPI = new DummySnapshotDBAPI();
        snapshotAPI = new DummySnapshotAPI();
    }

    @Override
    public void buildRepository(Repository repository) throws RepositoryNotFoundException {
        if (repository.getObjectDatabase().exists()) {
            updateRepositoryFromSnapshots(repository);
        } else {
            buildRepositoryFromScratch(repository);
        }
    }

    private void updateRepositoryFromSnapshots(Repository repository) {
        List<Snapshot> snapshotsToAdd = snapshotDBAPI.getSnapshotsToAddToRepository(repository);
    }

    private void buildRepositoryFromScratch(Repository repository) throws RepositoryNotFoundException {
        if (!snapshotDBAPI.repositoryExists(repository)) {
            throw new RepositoryNotFoundException(repository.getDirectory());
        }
        updateRepositoryFromSnapshots(repository);
    }

}
