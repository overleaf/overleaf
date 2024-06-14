package uk.ac.ic.wlgitbridge.data.filestore;

import java.io.File;
import java.io.IOException;
import java.util.Date;
import java.util.List;
import uk.ac.ic.wlgitbridge.data.model.Snapshot;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 14/11/14.
 */
public class GitDirectoryContents {

  private final List<RawFile> files;
  private final File gitDirectory;
  private final String userName;
  private final String userEmail;
  private final String commitMessage;
  private final Date when;

  public GitDirectoryContents(
      List<RawFile> files,
      File rootGitDirectory,
      String projectName,
      String userName,
      String userEmail,
      String commitMessage,
      Date when) {
    this.files = files;
    this.gitDirectory = new File(rootGitDirectory, projectName);
    this.userName = userName;
    this.userEmail = userEmail;
    this.commitMessage = commitMessage;
    this.when = when;
  }

  public GitDirectoryContents(
      List<RawFile> files, File rootGitDirectory, String projectName, Snapshot snapshot) {
    this(
        files,
        rootGitDirectory,
        projectName,
        snapshot.getUserName(),
        snapshot.getUserEmail(),
        snapshot.getComment(),
        snapshot.getCreatedAt());
  }

  public void write() throws IOException {
    Util.deleteInDirectoryApartFrom(gitDirectory, ".git");
    for (RawFile fileNode : files) {
      fileNode.writeToDisk(gitDirectory);
    }
  }

  public File getDirectory() {
    return gitDirectory;
  }

  public String getUserName() {
    return userName;
  }

  public String getUserEmail() {
    return userEmail;
  }

  public String getCommitMessage() {
    return commitMessage;
  }

  public Date getWhen() {
    return when;
  }
}
