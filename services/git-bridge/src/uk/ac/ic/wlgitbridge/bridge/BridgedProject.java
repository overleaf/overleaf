package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.lib.Repository;

/**
 * Created by Winston on 05/11/14.
 */
public class BridgedProject {

    private final Repository repository;

    public BridgedProject(Repository repository) {
        this.repository = repository;
    }

}
