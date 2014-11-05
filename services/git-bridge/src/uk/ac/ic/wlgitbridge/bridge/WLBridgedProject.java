package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.api.AddCommand;
import org.eclipse.jgit.api.CommitCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.writelatex.Snapshot;
import uk.ac.ic.wlgitbridge.writelatex.api.SnapshotDBAPI;

import java.io.File;
import java.io.IOException;
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
        if (!snapshotDBAPI.repositoryExists(name)) {
            throw new RepositoryNotFoundException(name);
        }
        try {
            repository.create();
        } catch (IOException e) {
            e.printStackTrace();
        }
        updateRepositoryFromSnapshots(repository);
    }

}
