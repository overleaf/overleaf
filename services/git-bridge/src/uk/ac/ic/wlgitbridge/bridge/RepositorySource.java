package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;

import java.io.File;

/**
 * Created by Winston on 03/11/14.
 */
public interface RepositorySource {

    public Repository getRepositoryWithNameAtRootDirectory(String name, File rootDirectory) throws RepositoryNotFoundException;

}
