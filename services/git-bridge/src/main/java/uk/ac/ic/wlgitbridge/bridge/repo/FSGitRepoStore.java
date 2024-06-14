package uk.ac.ic.wlgitbridge.bridge.repo;

import static uk.ac.ic.wlgitbridge.util.Util.deleteInDirectoryApartFrom;

import com.google.api.client.repackaged.com.google.common.base.Preconditions;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import org.apache.commons.io.FileUtils;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Project;
import uk.ac.ic.wlgitbridge.util.Tar;

/*
 * Created by winston on 20/08/2016.
 */
public class FSGitRepoStore implements RepoStore {

  private static final long DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

  private final String repoStorePath;

  private final File rootDirectory;

  private final long maxFileSize;

  private final Function<File, Long> fsSizer;

  public FSGitRepoStore(String repoStorePath, Optional<Long> maxFileSize) {
    this(
        repoStorePath,
        maxFileSize.orElse(DEFAULT_MAX_FILE_SIZE),
        d -> d.getTotalSpace() - d.getFreeSpace());
  }

  public FSGitRepoStore(String repoStorePath, long maxFileSize, Function<File, Long> fsSizer) {
    this.repoStorePath = repoStorePath;
    rootDirectory = initRootGitDirectory(repoStorePath);
    this.maxFileSize = maxFileSize;
    this.fsSizer = fsSizer;
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
  public ProjectRepo initRepo(String project) throws IOException {
    GitProjectRepo ret = GitProjectRepo.fromName(project);
    ret.initRepo(this);
    return new WalkOverrideGitRepo(ret, Optional.of(maxFileSize), Optional.empty());
  }

  @Override
  public ProjectRepo getExistingRepo(String project) throws IOException {
    GitProjectRepo ret = GitProjectRepo.fromName(project);
    ret.useExistingRepository(this);
    return new WalkOverrideGitRepo(ret, Optional.of(maxFileSize), Optional.empty());
  }

  @Override
  public ProjectRepo useJGitRepo(Repository repo, ObjectId commitId) {
    GitProjectRepo ret = GitProjectRepo.fromJGitRepo(repo);
    return new WalkOverrideGitRepo(ret, Optional.of(maxFileSize), Optional.of(commitId));
  }

  /* TODO: Perhaps we should just delete bad directories on the fly. */
  @Override
  public void purgeNonexistentProjects(Collection<String> existingProjectNames) {
    List<String> excludedFromDeletion = new ArrayList<>(existingProjectNames);
    excludedFromDeletion.add(".wlgb");
    deleteInDirectoryApartFrom(rootDirectory, excludedFromDeletion.toArray(new String[] {}));
  }

  @Override
  public long totalSize() {
    return fsSizer.apply(rootDirectory);
  }

  @Override
  public InputStream bzip2Project(String projectName, long[] sizePtr) throws IOException {
    Project.checkValidProjectName(projectName);
    Log.debug("[{}] bzip2 project", projectName);
    return Tar.bz2.zip(getDotGitForProject(projectName), sizePtr);
  }

  @Override
  public InputStream gzipProject(String projectName, long[] sizePtr) throws IOException {
    Project.checkValidProjectName(projectName);
    Log.debug("[{}] gzip project", projectName);
    return Tar.gzip.zip(getDotGitForProject(projectName), sizePtr);
  }

  @Override
  public void gcProject(String projectName) throws IOException {
    Project.checkValidProjectName(projectName);
    ProjectRepo repo = getExistingRepo(projectName);
    repo.runGC();
  }

  @Override
  public void remove(String projectName) throws IOException {
    Project.checkValidProjectName(projectName);
    FileUtils.deleteDirectory(new File(rootDirectory, projectName));
  }

  @Override
  public void unbzip2Project(String projectName, InputStream dataStream) throws IOException {
    Preconditions.checkArgument(
        Project.isValidProjectName(projectName), "[%s] invalid project name: ", projectName);
    Preconditions.checkState(
        getDirForProject(projectName).mkdirs(),
        "[%s] directories for " + "evicted project already exist",
        projectName);
    Log.debug("[{}] un-bzip2 project", projectName);
    Tar.bz2.unzip(dataStream, getDirForProject(projectName));
  }

  @Override
  public void ungzipProject(String projectName, InputStream dataStream) throws IOException {
    Preconditions.checkArgument(
        Project.isValidProjectName(projectName), "[%s] invalid project name: ", projectName);
    Preconditions.checkState(
        getDirForProject(projectName).mkdirs(),
        "[%s] directories for " + "evicted project already exist",
        projectName);
    Log.debug("[{}] un-gzip project", projectName);
    Tar.gzip.unzip(dataStream, getDirForProject(projectName));
  }

  private File getDirForProject(String projectName) {
    Project.checkValidProjectName(projectName);
    return Paths.get(rootDirectory.getAbsolutePath()).resolve(projectName).toFile();
  }

  private File getDotGitForProject(String projectName) {
    Project.checkValidProjectName(projectName);
    return Paths.get(rootDirectory.getAbsolutePath()).resolve(projectName).resolve(".git").toFile();
  }

  private File initRootGitDirectory(String rootGitDirectoryPath) {
    File rootGitDirectory = new File(rootGitDirectoryPath);
    rootGitDirectory.mkdirs();
    Preconditions.checkArgument(
        rootGitDirectory.isDirectory(),
        "given root git directory " + "is not a directory: %s",
        rootGitDirectory.getAbsolutePath());
    return rootGitDirectory;
  }
}
