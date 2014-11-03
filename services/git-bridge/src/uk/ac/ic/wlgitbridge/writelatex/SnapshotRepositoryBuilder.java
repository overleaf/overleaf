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
public class SnapshotRepositoryBuilder implements RepositorySource {

    @Override
    public Repository getRepositoryWithNameAtRootDirectory(String name, File rootDirectory) throws RepositoryNotFoundException {
        File repositoryRoot = new File(rootDirectory.getAbsolutePath(), name);

        Repository repository = null;
        try {
            repository = new FileRepositoryBuilder().setWorkTree(repositoryRoot).build();
        } catch (IOException e) {
            throw new RepositoryNotFoundException(name);
        }
        if (!repository.getObjectDatabase().exists()) {
            throw new RepositoryNotFoundException(name);
        }
        return repository;
    }

}
