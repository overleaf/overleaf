package uk.ac.ic.wlgitbridge.bridge.repo;

import com.google.api.client.repackaged.com.google.common.base.Preconditions;
import org.apache.commons.io.FileUtils;
import uk.ac.ic.wlgitbridge.util.Project;
import uk.ac.ic.wlgitbridge.util.Tar;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import static uk.ac.ic.wlgitbridge.util.Util.deleteInDirectoryApartFrom;

/**
 * Created by winston on 20/08/2016.
 */
public class FSGitRepoStore implements RepoStore {

    private final String repoStorePath;
    private final File rootDirectory;

    public FSGitRepoStore(String repoStorePath) {
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

    /* TODO: Perhaps we should just delete bad directories on the fly. */
    @Override
    public void purgeNonexistentProjects(
            Collection<String> existingProjectNames
    ) {
        List<String> excludedFromDeletion =
                new ArrayList<>(existingProjectNames);
        excludedFromDeletion.add(".wlgb");
        deleteInDirectoryApartFrom(
                rootDirectory,
                excludedFromDeletion.toArray(new String[] {})
        );
    }

    @Override
    public long totalSize() {
        return FileUtils.sizeOfDirectory(rootDirectory);
    }

    @Override
    public InputStream bzip2Project(
            String projectName,
            long[] sizePtr
    ) throws IOException {
        Preconditions.checkArgument(Project.isValidProjectName(projectName));
        return Tar.bz2.zip(getDotGitForProject(projectName), sizePtr);
    }

    @Override
    public void remove(String projectName) throws IOException {
        Preconditions.checkArgument(Project.isValidProjectName(projectName));
        FileUtils.deleteDirectory(new File(rootDirectory, projectName));
    }

    @Override
    public void unbzip2Project(
            String projectName,
            InputStream dataStream
    ) throws IOException {
        Preconditions.checkArgument(Project.isValidProjectName(projectName));
        Preconditions.checkState(getDirForProject(projectName).mkdirs());
        Tar.bz2.unzip(dataStream, getDirForProject(projectName));
    }

    private File getDirForProject(String projectName) {
        Preconditions.checkArgument(Project.isValidProjectName(projectName));
        return Paths.get(
                rootDirectory.getAbsolutePath()
        ).resolve(
                projectName
        ).toFile();
    }

    private File getDotGitForProject(String projectName) {
        Preconditions.checkArgument(Project.isValidProjectName(projectName));
        return Paths.get(
                rootDirectory.getAbsolutePath()
        ).resolve(
                projectName
        ).resolve(
                ".git"
        ).toFile();
    }

    private File initRootGitDirectory(String rootGitDirectoryPath) {
        File rootGitDirectory = new File(rootGitDirectoryPath);
        rootGitDirectory.mkdirs();
        Preconditions.checkArgument(rootGitDirectory.isDirectory());
        return rootGitDirectory;
    }

}
