package uk.ac.ic.wlgitbridge.writelatex;

import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.bridge.RepositorySource;
import uk.ac.ic.wlgitbridge.bridge.WLBridgedProject;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

import java.io.File;
import java.io.IOException;

/**
 * Created by Winston on 03/11/14.
 */
public class SnapshotRepositoryBuilder implements RepositorySource {

    private final WriteLatexDataSource writeLatexDataSource;

    public SnapshotRepositoryBuilder(WriteLatexDataSource writeLatexDataSource) {
        this.writeLatexDataSource = writeLatexDataSource;
    }

    @Override
    public Repository getRepositoryWithNameAtRootDirectory(String name, File rootDirectory) throws RepositoryNotFoundException, ServiceNotEnabledException {
        File repositoryDirectory = new File(rootDirectory, name);

        Repository repository = null;
        try {
            repository = new FileRepositoryBuilder().setWorkTree(repositoryDirectory).build();
            new WLBridgedProject(repository, name, writeLatexDataSource).buildRepository();
        } catch (FailedConnectionException e) {
            throw new ServiceNotEnabledException();
        } catch (IOException e) {
            throw new ServiceNotEnabledException();
        }
        return repository;
    }

}
