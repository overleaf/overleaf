package uk.ac.ic.wlgitbridge.writelatex;

import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;

/**
 * Created by Winston on 03/11/14.
 */
public interface RepositoryBuilder {

    public void buildRepository(Repository repository) throws RepositoryNotFoundException;

}
