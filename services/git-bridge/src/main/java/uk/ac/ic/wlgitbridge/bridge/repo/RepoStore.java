package uk.ac.ic.wlgitbridge.bridge.repo;

import uk.ac.ic.wlgitbridge.bridge.db.DBStore;

import java.io.File;
import java.util.Collection;

/**
 * Created by winston on 20/08/2016.
 */
public interface RepoStore {

    String getRepoStorePath();

    File getRootDirectory();


    void purgeNonexistentProjects(
            Collection<String> existingProjectNames
    );

}
