package uk.ac.ic.wlgitbridge.bridge.repo;

import java.io.File;
import java.io.IOException;
import java.util.Collection;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;

/*
 * Created by winston on 20/08/2016.
 */
public interface ProjectRepo {

  String getProjectName();

  void initRepo(RepoStore repoStore) throws IOException;

  void useExistingRepository(RepoStore repoStore) throws IOException;

  RawDirectory getDirectory() throws IOException, GitUserException;

  Collection<String> commitAndGetMissing(GitDirectoryContents gitDirectoryContents)
      throws IOException, GitUserException;

  void runGC() throws IOException;

  void deleteIncomingPacks() throws IOException;

  File getProjectDir();

  Repository getJGitRepository();
}
