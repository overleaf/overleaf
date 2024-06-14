package uk.ac.ic.wlgitbridge.bridge.repo;

import java.io.File;
import java.io.IOException;
import java.util.Collection;
import java.util.Optional;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;

/*
 * This class takes a GitProjectRepo and delegates all calls to it.
 *
 * The purpose is to insert a file size check in {@link #getDirectory()}.
 *
 * We delegate instead of subclass because we can't override the static
 * constructors in {@link GitProjectRepo}.
 */
public class WalkOverrideGitRepo implements ProjectRepo {

  private final GitProjectRepo gitRepo;

  private final Optional<Long> maxFileSize;

  private final Optional<ObjectId> commitId;

  public WalkOverrideGitRepo(
      GitProjectRepo gitRepo, Optional<Long> maxFileSize, Optional<ObjectId> commitId) {
    this.gitRepo = gitRepo;
    this.maxFileSize = maxFileSize;
    this.commitId = commitId;
  }

  @Override
  public String getProjectName() {
    return gitRepo.getProjectName();
  }

  @Override
  public void initRepo(RepoStore repoStore) throws IOException {
    gitRepo.initRepo(repoStore);
  }

  @Override
  public void useExistingRepository(RepoStore repoStore) throws IOException {
    gitRepo.useExistingRepository(repoStore);
  }

  @Override
  public RawDirectory getDirectory() throws IOException, GitUserException {
    Repository repo = gitRepo.getJGitRepository();
    RepositoryObjectTreeWalker walker;
    if (commitId.isPresent()) {
      walker = new RepositoryObjectTreeWalker(repo, commitId.get());
    } else {
      walker = new RepositoryObjectTreeWalker(repo);
    }
    return walker.getDirectoryContents(maxFileSize);
  }

  @Override
  public Collection<String> commitAndGetMissing(GitDirectoryContents gitDirectoryContents)
      throws GitUserException, IOException {
    return gitRepo.commitAndGetMissing(gitDirectoryContents);
  }

  @Override
  public void runGC() throws IOException {
    gitRepo.runGC();
  }

  @Override
  public void deleteIncomingPacks() throws IOException {
    gitRepo.deleteIncomingPacks();
  }

  @Override
  public File getProjectDir() {
    return gitRepo.getProjectDir();
  }

  @Override
  public Repository getJGitRepository() {
    return gitRepo.getJGitRepository();
  }
}
