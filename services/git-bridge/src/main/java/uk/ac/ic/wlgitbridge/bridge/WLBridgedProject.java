package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;

import java.io.IOException;
import java.util.List;
import java.util.TimeZone;

/**
 * Created by Winston on 05/11/14.
 */
public class WLBridgedProject {

    private final Repository repository;
    private final String name;
    private final WriteLatexDataSource writeLatexDataSource;

    public WLBridgedProject(Repository repository, String name, WriteLatexDataSource writeLatexDataSource) {
        this.repository = repository;
        this.name = name;
        this.writeLatexDataSource = writeLatexDataSource;
    }

    public void buildRepository() throws RepositoryNotFoundException, ServiceMayNotContinueException {
        writeLatexDataSource.lockForProject(name);
        if (repository.getObjectDatabase().exists()) {
            updateRepositoryFromSnapshots(repository);
        } else {
            buildRepositoryFromScratch(repository);
        }
        writeLatexDataSource.unlockForProject(name);
    }

    private void updateRepositoryFromSnapshots(Repository repository) throws RepositoryNotFoundException, ServiceMayNotContinueException {
        List<WritableRepositoryContents> writableRepositories;
        try {
            writableRepositories = writeLatexDataSource.getWritableRepositories(name);
        } catch (InvalidProjectException e) {
            throw new RepositoryNotFoundException(name);
        }
        try {
            for (WritableRepositoryContents contents : writableRepositories) {
                contents.write();
                Git git = new Git(repository);
                for (String missing : git.status().call().getMissing()) {
                    git.rm().setCached(true).addFilepattern(missing).call();
                }
                git.add().addFilepattern(".").call();
                git.commit().setAuthor(new PersonIdent(contents.getUserName(), contents.getUserEmail(), contents.getWhen(), TimeZone.getDefault()))
                            .setMessage(contents.getCommitMessage())
                            .call();
                WLFileStore.deleteInDirectoryApartFrom(contents.getDirectory(), ".git");
            }
        } catch (GitAPIException e) {
            throw new ServiceMayNotContinueException(e);
        } catch (IOException e) {
            throw new ServiceMayNotContinueException(e);
        }
    }

    private void buildRepositoryFromScratch(Repository repository) throws RepositoryNotFoundException, ServiceMayNotContinueException {
        if (!writeLatexDataSource.repositoryExists(name)) {
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
