package uk.ac.ic.wlgitbridge.bridge;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
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

    public void buildRepository(Credential oauth2) throws RepositoryNotFoundException, ServiceMayNotContinueException, ForbiddenException {
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

    private void updateRepositoryFromSnapshots(Credential oauth2, Repository repository) throws RepositoryNotFoundException, ServiceMayNotContinueException, ForbiddenException {
        try {
            bridgeAPI.getWritableRepositories(oauth2, name, repository);
        } catch (InvalidProjectException e) {
            throw new RepositoryNotFoundException(name);
        } catch (SnapshotPostException e) {
            throw new ServiceMayNotContinueException(e.getDescriptionLines().get(0), e);
        } catch (GitAPIException e) {
            throw new ServiceMayNotContinueException(e);
        } catch (IOException e) {
            throw new ServiceMayNotContinueException(e);
        }
    }

    private void buildRepositoryFromScratch(Credential oauth2, Repository repository) throws RepositoryNotFoundException, ServiceMayNotContinueException, ForbiddenException {
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
