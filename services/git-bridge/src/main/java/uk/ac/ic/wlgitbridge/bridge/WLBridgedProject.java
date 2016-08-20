package uk.ac.ic.wlgitbridge.bridge;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.exception.InvalidProjectException;

import java.io.IOException;

/**
 * Created by Winston on 05/11/14.
 */
public class WLBridgedProject {

    private final Repository repository;
    private final String name;
    private final Bridge bridgeAPI;

    public WLBridgedProject(Repository repository, String name, Bridge bridgeAPI) {
        this.repository = repository;
        this.name = name;
        this.bridgeAPI = bridgeAPI;
    }

    public void buildRepository(Credential oauth2) throws RepositoryNotFoundException, ServiceMayNotContinueException, GitUserException {
        bridgeAPI.lockForProject(name);
        try {
            if (repository.getObjectDatabase().exists()) {
                updateRepositoryFromSnapshots(oauth2, repository);
            } else {
                buildRepositoryFromScratch(oauth2, repository);
            }
        } catch (RuntimeException e) {
            e.printStackTrace();
            throw new ServiceMayNotContinueException(e);
        } finally {
            bridgeAPI.unlockForProject(name);
        }
    }

    private void updateRepositoryFromSnapshots(
            Credential oauth2,
            Repository repository
    ) throws RepositoryNotFoundException,
             ServiceMayNotContinueException,
             GitUserException {
        try {
            bridgeAPI.getWritableRepositories(
                    oauth2,
                    new GitProjectRepo(repository, name)
            );
        } catch (InvalidProjectException e) {
            throw new RepositoryNotFoundException(name);
        } catch (IOException e) {
            throw new ServiceMayNotContinueException(e);
        }
    }

    private void buildRepositoryFromScratch(Credential oauth2, Repository repository) throws RepositoryNotFoundException, ServiceMayNotContinueException, GitUserException {
        if (!bridgeAPI.repositoryExists(oauth2, name)) {
            throw new RepositoryNotFoundException(name);
        }
        try {
            repository.create();
        } catch (IOException e) {
            throw new ServiceMayNotContinueException(e);
        }
        updateRepositoryFromSnapshots(oauth2, repository);
    }

}
