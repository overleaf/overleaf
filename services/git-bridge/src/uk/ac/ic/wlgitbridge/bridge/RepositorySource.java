package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

import java.io.File;

/**
 * Created by Winston on 03/11/14.
 */
public interface RepositorySource {

    public Repository getRepositoryWithNameAtRootDirectory(String name, File rootDirectory) throws RepositoryNotFoundException, ServiceNotEnabledException;

}
