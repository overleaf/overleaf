package uk.ac.ic.wlgitbridge.bridge.repo;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
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

    long totalSize();

    /*
     * Tars and bzip2s the .git directory of the given project. Throws an
     * IOException if the project doesn't exist. The returned stream is a copy
     * of the original .git directory, which must be deleted using remove().
     */
    InputStream bzip2Project(
            String projectName,
            long[] sizePtr
    ) throws IOException;

    default InputStream bzip2Project(
            String projectName
    ) throws IOException {
        return bzip2Project(projectName, null);
    }

    void remove(String projectName) throws IOException;

    /**
     * Unbzip2s the given data stream into a .git directory for projectName.
     * Creates the project directory.
     * If projectName already exists, throws an IOException.
     * @param projectName the name of the project, e.g. abc123
     * @param dataStream the data stream containing the bzipped contents.
     */
    void unbzip2Project(
            String projectName,
            InputStream dataStream
    ) throws IOException;

}
