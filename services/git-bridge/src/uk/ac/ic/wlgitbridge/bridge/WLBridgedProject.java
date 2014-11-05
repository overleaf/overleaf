package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.writelatex.Snapshot;
import uk.ac.ic.wlgitbridge.writelatex.SnapshotDBAPI;

import java.io.File;
import java.util.List;

/**
 * Created by Winston on 05/11/14.
 */
public class WLBridgedProject {

    private final Repository repository;
    private final String name;
    private final File repositoryDirectory;
    private final SnapshotDBAPI snapshotDBAPI;

    public WLBridgedProject(Repository repository, String name, File repositoryDirectory, SnapshotDBAPI snapshotDBAPI) {
        this.repository = repository;
        this.name = name;
        this.repositoryDirectory = repositoryDirectory;
        this.snapshotDBAPI = snapshotDBAPI;
    }

    public void buildRepository() throws RepositoryNotFoundException {
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
        System.out.println("Need to build repo: " + repository.getDirectory().getAbsolutePath());
        if (!snapshotDBAPI.repositoryExists(repository)) {
            throw new RepositoryNotFoundException(repository.getDirectory());
        }
        updateRepositoryFromSnapshots(repository);
    }

}
