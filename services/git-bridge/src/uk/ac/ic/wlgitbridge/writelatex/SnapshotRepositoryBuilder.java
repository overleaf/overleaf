package uk.ac.ic.wlgitbridge.writelatex;

import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.bridge.RepositorySource;
import uk.ac.ic.wlgitbridge.bridge.WLBridgedProject;
import uk.ac.ic.wlgitbridge.writelatex.api.SnapshotDBAPI;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

import java.io.File;
import java.io.IOException;

/**
 * Created by Winston on 03/11/14.
 */
public class SnapshotRepositoryBuilder implements RepositorySource {

    private final SnapshotDBAPI snapshotDBAPI;

    public SnapshotRepositoryBuilder(SnapshotDBAPI snapshotDBAPI) {
        this.snapshotDBAPI = snapshotDBAPI;
    }

    @Override
    public Repository getRepositoryWithNameAtRootDirectory(String name, File rootDirectory) throws RepositoryNotFoundException, ServiceNotEnabledException {
        File repositoryDirectory = new File(rootDirectory.getAbsolutePath(), name);

        Repository repository = null;
        try {
            repository = new FileRepositoryBuilder().setWorkTree(repositoryDirectory).build();
        } catch (IOException e) {
            e.printStackTrace();
        }
        try {
            new WLBridgedProject(repository, name, repositoryDirectory, snapshotDBAPI).buildRepository();
        } catch (FailedConnectionException e) {
            e.printStackTrace();
        }
        return repository;
    }

}
