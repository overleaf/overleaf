package uk.ac.ic.wlgitbridge.snapshot.servermock.util;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Assert;
import org.junit.Test;

public class FileUtilTest {

  @Test
  public void returnsTrueWhenFilesAreEqualInBothDirectories() throws URISyntaxException {
    Path eq1 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsTrueWhenFilesAreEqualInBothDirectories/eq1")
                .toURI());
    Path eq2 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsTrueWhenFilesAreEqualInBothDirectories/eq2")
                .toURI());
    Assert.assertTrue(FileUtil.gitDirectoriesAreEqual(eq1, eq2));
  }

  @Test
  public void returnsTrueWhenRecursiveFilesAreEqualInBothDirectores() throws URISyntaxException {
    Path eq1 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsTrueWhenRecursiveFilesAreEqualInBothDirectories/eq1")
                .toURI());
    Path eq2 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsTrueWhenRecursiveFilesAreEqualInBothDirectories/eq2")
                .toURI());
    Assert.assertTrue(FileUtil.gitDirectoriesAreEqual(eq1, eq2));
  }

  @Test
  public void returnsFalseWhenFilesAreNotEqualInBothDirectories() throws URISyntaxException {
    Path neq1 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsFalseWhenFilesAreNotEqualInBothDirectories/neq1")
                .toURI());
    Path neq2 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsFalseWhenFilesAreNotEqualInBothDirectories/neq2")
                .toURI());
    Assert.assertFalse(FileUtil.gitDirectoriesAreEqual(neq1, neq2));
  }

  @Test
  public void returnsFalseWhenRecursiveFilesAreNotEqualInBothDirectories()
      throws URISyntaxException {
    Path neq1 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsFalseWhenRecursiveFilesAreNotEqualInBothDirectories/neq1")
                .toURI());
    Path neq2 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsFalseWhenRecursiveFilesAreNotEqualInBothDirectories/neq2")
                .toURI());
    Assert.assertFalse(FileUtil.gitDirectoriesAreEqual(neq1, neq2));
  }

  @Test
  public void returnsTrueEvenIfGitDirectoriesAreNotEqual() throws URISyntaxException {
    Path neq1 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsTrueEvenIfGitDirectoriesAreNotEqual/eq1")
                .toURI());
    Path neq2 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsTrueEvenIfGitDirectoriesAreNotEqual/eq2")
                .toURI());
    Assert.assertTrue(FileUtil.gitDirectoriesAreEqual(neq1, neq2));
  }

  @Test
  public void returnsFalseIfFileNamesAreNotEqual() throws URISyntaxException {
    Path neq1 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsFalseIfFileNamesAreNotEqual/neq1")
                .toURI());
    Path neq2 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsFalseIfFileNamesAreNotEqual/neq2")
                .toURI());
    Assert.assertFalse(FileUtil.gitDirectoriesAreEqual(neq1, neq2));
  }

  @Test
  public void returnsFalseIfInnerDirectoryNamesAreNotEqual() throws URISyntaxException {
    Path neq1 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsFalseIfInnerDirectoryNamesAreNotEqual/neq1")
                .toURI());
    Path neq2 =
        Paths.get(
            getClass()
                .getResource(
                    "/uk/ac/ic/wlgitbridge/snapshot/servermock/util/FileUtilTest/returnsFalseIfInnerDirectoryNamesAreNotEqual/neq2")
                .toURI());
    Assert.assertFalse(FileUtil.gitDirectoriesAreEqual(neq1, neq2));
  }
}
