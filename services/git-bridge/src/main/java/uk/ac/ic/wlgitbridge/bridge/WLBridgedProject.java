package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;

import java.io.IOException;

/**
 * Created by Winston on 05/11/14.
 */
public class WLBridgedProject {

    private final Repository repository;
    private final String name;
    private final BridgeAPI bridgeAPI;

    public WLBridgedProject(Repository repository, String name, BridgeAPI bridgeAPI) {
        this.repository = repository;
        this.name = name;
        this.bridgeAPI = bridgeAPI;
    }

    public void buildRepository() throws RepositoryNotFoundException, ServiceMayNotContinueException {
        bridgeAPI.lockForProject(name);
        try {
            if (repository.getObjectDatabase().exists()) {
                updateRepositoryFromSnapshots(repository);
            } else {
                buildRepositoryFromScratch(repository);
            }
        } catch (RuntimeException e) {
            e.printStackTrace();
            throw new ServiceMayNotContinueException(e);
        } finally {
            bridgeAPI.unlockForProject(name);
        }
    }

    private void updateRepositoryFromSnapshots(Repository repository) throws RepositoryNotFoundException, ServiceMayNotContinueException {
        try {
            bridgeAPI.getWritableRepositories(name, repository);
        } catch (InvalidProjectException e) {
            throw new RepositoryNotFoundException(name);
        } catch (SnapshotPostException e) {
            throw new RepositoryNotFoundException(name);
        } catch (GitAPIException e) {
            throw new ServiceMayNotContinueException(e);
        } catch (IOException e) {
            throw new ServiceMayNotContinueException(e);
        }
    }

    private void buildRepositoryFromScratch(Repository repository) throws RepositoryNotFoundException, ServiceMayNotContinueException {
        if (!bridgeAPI.repositoryExists(name)) {
            throw new RepositoryNotFoundException(name);
        }
        try {
            repository.create();
        } catch (IOException e) {
            throw new ServiceMayNotContinueException(e);
        }
        updateRepositoryFromSnapshots(repository);
    }

}
