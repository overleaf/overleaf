package uk.ac.ic.wlgitbridge.writelatex;

import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import uk.ac.ic.wlgitbridge.bridge.RepositorySource;

import java.io.File;
import java.io.IOException;

/**
 * Created by Winston on 03/11/14.
 */
public class SnapshotRepositorySource implements RepositorySource {

    private RepositoryBuilder repositoryBuilder;

    public SnapshotRepositorySource() {
        repositoryBuilder = new SnapshotRepositoryBuilder();
    }

    @Override
    public Repository getRepositoryWithNameAtRootDirectory(String name, File rootDirectory) throws RepositoryNotFoundException {
        File repositoryDirectory = new File(rootDirectory.getAbsolutePath(), name);

        Repository repository = null;
        try {
            repository = new FileRepositoryBuilder().setWorkTree(repositoryDirectory).build();
        } catch (IOException e) {
            throw new RepositoryNotFoundException(name);
        }
        repositoryBuilder.buildRepository(repository);
        return repository;
    }

}
