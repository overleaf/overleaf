package uk.ac.ic.wlgitbridge.bridge.repo;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collection;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;

/*
 * Created by winston on 20/08/2016.
 */
public interface RepoStore {

  /* Still need to get rid of these two methods.
  Main dependency: GitRepoStore needs a Repository which needs a directory.
  Instead, use a visitor or something. */
  String getRepoStorePath();

  File getRootDirectory();

  ProjectRepo initRepo(String project) throws IOException;

  ProjectRepo getExistingRepo(String project) throws IOException;

  ProjectRepo useJGitRepo(Repository repo, ObjectId commitId);

  void purgeNonexistentProjects(Collection<String> existingProjectNames);

  long totalSize();

  /*
   * Tars and bzip2s the .git directory of the given project. Throws an
   * IOException if the project doesn't exist. The returned stream is a copy
   * of the original .git directory, which must be deleted using remove().
   */
  InputStream bzip2Project(String projectName, long[] sizePtr) throws IOException;

  default InputStream bzip2Project(String projectName) throws IOException {
    return bzip2Project(projectName, null);
  }

  /*
   * Tars and gzips the .git directory of the given project. Throws an
   * IOException if the project doesn't exist. The returned stream is a copy
   * of the original .git directory, which must be deleted using remove().
   */
  InputStream gzipProject(String projectName, long[] sizePtr) throws IOException;

  default InputStream gzipProject(String projectName) throws IOException {
    return gzipProject(projectName, null);
  }

  void gcProject(String projectName) throws IOException;

  /*
   * Called after {@link #bzip2Project(String, long[])}'s has been safely
   * uploaded to the swap store. Removes all traces of the project from disk,
   * i.e. not just its .git, but the whole project's git directory.
   * @param projectName
   * @throws IOException
   */
  void remove(String projectName) throws IOException;

  /*
   * Unbzip2s the given data stream into a .git directory for projectName.
   * Creates the project's git directory.
   * If projectName already exists, throws an IOException.
   * @param projectName the name of the project, e.g. abc123
   * @param dataStream the data stream containing the bzipped contents.
   */
  void unbzip2Project(String projectName, InputStream dataStream) throws IOException;

  /*
   * Ungzips the given data stream into a .git directory for projectName.
   * Creates the project's git directory.
   * If projectName already exists, throws an IOException.
   * @param projectName the name of the project, e.g. abc123
   * @param dataStream the data stream containing the gzip contents.
   */
  void ungzipProject(String projectName, InputStream dataStream) throws IOException;
}
