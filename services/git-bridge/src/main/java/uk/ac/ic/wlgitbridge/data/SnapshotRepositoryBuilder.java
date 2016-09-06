package uk.ac.ic.wlgitbridge.data;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.bridge.WLBridgedProject;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.InternalErrorException;
import uk.ac.ic.wlgitbridge.util.Log;

import java.io.File;
import java.io.IOException;

/**
 * Created by Winston on 03/11/14.
 */
public class SnapshotRepositoryBuilder {

    private final Bridge bridgeAPI;

    public SnapshotRepositoryBuilder(Bridge bridgeAPI) {
        this.bridgeAPI = bridgeAPI;
    }

    public Repository getRepositoryWithNameAtRootDirectory(String name, File rootDirectory, Credential oauth2) throws RepositoryNotFoundException, ServiceMayNotContinueException, GitUserException {
        if (!bridgeAPI.repositoryExists(oauth2, name)) {
            throw new RepositoryNotFoundException(name);
        }
        File repositoryDirectory = new File(rootDirectory, name);

        Repository repository = null;
        try {
            repository = new FileRepositoryBuilder().setWorkTree(repositoryDirectory).build();
            new WLBridgedProject(repository, name, bridgeAPI).buildRepository(oauth2);
        } catch (IOException e) {
            Log.warn(
                    "IOException when trying to get repo: " +
                            name +
                            ", at: "
                            + rootDirectory.getAbsolutePath(),
                    e
            );
            throw new ServiceMayNotContinueException(
                    new InternalErrorException().getDescriptionLines().get(0)
            );
        }
        return repository;
    }

}
