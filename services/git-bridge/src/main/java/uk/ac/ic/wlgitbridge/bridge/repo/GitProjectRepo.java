package uk.ac.ic.wlgitbridge.bridge.repo;

import com.google.common.base.Preconditions;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.FileVisitor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import org.apache.commons.io.IOUtils;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Project;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Class representing a Git repository.
 *
 * It stores the projectName and repo separately because the hooks need to be
 * able to construct one of these without knowing whether the repo exists yet.
 *
 * It can then be passed to the Bridge, which will either
 * {@link #initRepo(RepoStore)} for a never-seen-before repo, or
 * {@link #useExistingRepository(RepoStore)} for an existing repo.
 *
 * Make sure to acquire the project lock before calling methods here.
 */
public class GitProjectRepo implements ProjectRepo {

  private final String projectName;
  private Optional<Repository> repository;

  public static GitProjectRepo fromJGitRepo(Repository repo) {
    return new GitProjectRepo(repo.getWorkTree().getName(), Optional.of(repo));
  }

  public static GitProjectRepo fromName(String projectName) {
    return new GitProjectRepo(projectName, Optional.empty());
  }

  GitProjectRepo(String projectName, Optional<Repository> repository) {
    Preconditions.checkArgument(Project.isValidProjectName(projectName));
    this.projectName = projectName;
    this.repository = repository;
  }

  @Override
  public String getProjectName() {
    return projectName;
  }

  @Override
  public void initRepo(RepoStore repoStore) throws IOException {
    initRepositoryField(repoStore);
    Preconditions.checkState(repository.isPresent());
    Repository repo = this.repository.get();
    // TODO: assert that this is a fresh repo. At the moment, we can't be
    // sure whether the repo to be init'd doesn't exist or is just fresh
    // and we crashed / aborted while committing
    if (repo.getObjectDatabase().exists()) return;
    repo.create();
  }

  @Override
  public void useExistingRepository(RepoStore repoStore) throws IOException {
    initRepositoryField(repoStore);
    Preconditions.checkState(repository.isPresent());
    Preconditions.checkState(repository.get().getObjectDatabase().exists());
  }

  @Override
  public RawDirectory getDirectory() throws IOException, GitUserException {
    Preconditions.checkState(repository.isPresent());
    return new RepositoryObjectTreeWalker(repository.get()).getDirectoryContents(Optional.empty());
  }

  @Override
  public Collection<String> commitAndGetMissing(GitDirectoryContents contents) throws IOException {
    try {
      return doCommitAndGetMissing(contents);
    } catch (GitAPIException e) {
      throw new IOException(e);
    }
  }

  @Override
  public void runGC() throws IOException {
    Preconditions.checkState(repository.isPresent(), "Repo is not present");
    File dir = getProjectDir();
    Preconditions.checkState(dir.isDirectory());
    Log.debug("[{}] Running git gc", projectName);
    Process proc = new ProcessBuilder("git", "gc").directory(dir).start();
    int exitCode;
    try {
      exitCode = proc.waitFor();
      Log.debug("Exit: {}", exitCode);
    } catch (InterruptedException e) {
      throw new RuntimeException(e);
    }
    if (exitCode != 0) {
      Log.warn("[{}] Git gc failed", dir.getAbsolutePath());
      Log.warn(IOUtils.toString(proc.getInputStream(), StandardCharsets.UTF_8));
      Log.warn(IOUtils.toString(proc.getErrorStream(), StandardCharsets.UTF_8));
      throw new IOException("git gc error");
    }
    Log.debug("[{}] git gc successful", projectName);
  }

  @Override
  public void deleteIncomingPacks() throws IOException {
    Log.debug("[{}] Checking for garbage `incoming` files", projectName);
    Files.walkFileTree(
        getDotGitDir().toPath(),
        new FileVisitor<Path>() {
          @Override
          public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs)
              throws IOException {
            return FileVisitResult.CONTINUE;
          }

          @Override
          public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)
              throws IOException {
            File file_ = file.toFile();
            String name = file_.getName();
            if (name.startsWith("incoming_") && name.endsWith(".pack")) {
              Log.debug("Deleting garbage `incoming` file: {}", file_);
              Preconditions.checkState(file_.delete());
            }
            return FileVisitResult.CONTINUE;
          }

          @Override
          public FileVisitResult visitFileFailed(Path file, IOException exc) throws IOException {
            Preconditions.checkNotNull(file);
            Preconditions.checkNotNull(exc);
            Log.warn("Failed to visit file: " + file, exc);
            return FileVisitResult.TERMINATE;
          }

          @Override
          public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
            Preconditions.checkNotNull(dir);
            if (exc != null) {
              return FileVisitResult.TERMINATE;
            }
            return FileVisitResult.CONTINUE;
          }
        });
  }

  @Override
  public File getProjectDir() {
    return getJGitRepository().getDirectory().getParentFile();
  }

  public void resetHard() throws IOException {
    Git git = new Git(getJGitRepository());
    try {
      git.reset().setMode(ResetCommand.ResetType.HARD).call();
    } catch (GitAPIException e) {
      throw new IOException(e);
    }
  }

  @Override
  public Repository getJGitRepository() {
    return repository.get();
  }

  public File getDotGitDir() {
    return getJGitRepository().getWorkTree();
  }

  private void initRepositoryField(RepoStore repoStore) throws IOException {
    Preconditions.checkNotNull(repoStore);
    Preconditions.checkArgument(Project.isValidProjectName(projectName));
    Preconditions.checkState(!repository.isPresent());
    repository = Optional.of(createJGitRepository(repoStore, projectName));
  }

  private Repository createJGitRepository(RepoStore repoStore, String projName) throws IOException {
    File repoDir = new File(repoStore.getRootDirectory(), projName);
    return new FileRepositoryBuilder().setWorkTree(repoDir).build();
  }

  private Collection<String> doCommitAndGetMissing(GitDirectoryContents contents)
      throws IOException, GitAPIException {
    Preconditions.checkState(repository.isPresent());
    Repository repo = getJGitRepository();
    resetHard();
    String name = getProjectName();
    Log.debug("[{}] Writing commit", name);
    contents.write();
    Git git = new Git(getJGitRepository());
    Log.debug("[{}] Getting missing files", name);
    Set<String> missingFiles = git.status().call().getMissing();
    for (String missing : missingFiles) {
      Log.debug("[{}] Git rm {}", name, missing);
      git.rm().setCached(true).addFilepattern(missing).call();
    }
    Log.debug("[{}] Calling Git add", name);
    git.add().setWorkingTreeIterator(new NoGitignoreIterator(repo)).addFilepattern(".").call();
    Log.debug("[{}] Calling Git commit", name);
    git.commit()
        .setAuthor(
            new PersonIdent(
                contents.getUserName(),
                contents.getUserEmail(),
                contents.getWhen(),
                TimeZone.getDefault()))
        .setMessage(contents.getCommitMessage())
        .call();
    Log.debug(
        "[{}] Deleting files in directory: {}", name, contents.getDirectory().getAbsolutePath());
    Util.deleteInDirectoryApartFrom(contents.getDirectory(), ".git");
    return missingFiles;
  }
}
