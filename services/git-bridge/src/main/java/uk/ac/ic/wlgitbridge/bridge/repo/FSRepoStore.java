package uk.ac.ic.wlgitbridge.bridge.repo;

import uk.ac.ic.wlgitbridge.util.Util;

import java.io.File;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Created by winston on 20/08/2016.
 */
public class FSRepoStore implements RepoStore {

    private final String repoStorePath;
    private final File rootDirectory;

    public FSRepoStore(String repoStorePath) {
        this.repoStorePath = repoStorePath;
        rootDirectory = initRootGitDirectory(repoStorePath);
    }

    @Override
    public String getRepoStorePath() {
        return repoStorePath;
    }

    @Override
    public File getRootDirectory() {
        return rootDirectory;
    }

    @Override
    public void purgeNonexistentProjects(
            Collection<String> existingProjectNames
    ) {
        List<String> excludedFromDeletion =
                new ArrayList<>(existingProjectNames);
        excludedFromDeletion.add(".wlgb");
        Util.deleteInDirectoryApartFrom(
                rootDirectory,
                excludedFromDeletion.toArray(new String[] {})
        );
    }

    private File initRootGitDirectory(String rootGitDirectoryPath) {
        File rootGitDirectory = new File(rootGitDirectoryPath);
        rootGitDirectory.mkdirs();
        return rootGitDirectory;
    }

}
