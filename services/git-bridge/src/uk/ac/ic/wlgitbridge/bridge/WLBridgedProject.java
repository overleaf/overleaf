package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.api.AddCommand;
import org.eclipse.jgit.api.CommitCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.writelatex.api.SnapshotDBAPI;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;

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

    public void buildRepository() throws RepositoryNotFoundException, ServiceNotEnabledException {
        if (repository.getObjectDatabase().exists()) {
            updateRepositoryFromSnapshots(repository);
        } else {
            buildRepositoryFromScratch(repository);
        }
    }

    private void updateRepositoryFromSnapshots(Repository repository) throws ServiceNotEnabledException {
        try {
            List<Snapshot> snapshotsToAdd = snapshotDBAPI.getSnapshotsToAddToProject(name);
            for (Snapshot snapshot : snapshotsToAdd) {
                snapshot.writeToDisk(repositoryDirectory.getAbsolutePath());
                Git git = new Git(repository);
                git.add().addFilepattern(".").call();
                git.commit().setAuthor(snapshot.getUserName(), snapshot.getUserEmail()).setMessage(snapshot.getComment()).call();
            }
        } catch (Throwable throwable) {
            throwable.printStackTrace();
            throw new ServiceNotEnabledException();
        }
    }

    private void buildRepositoryFromScratch(Repository repository) throws RepositoryNotFoundException, ServiceNotEnabledException {
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
