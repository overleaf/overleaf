package uk.ac.ic.wlgitbridge.bridge.repo;

import static org.junit.Assert.*;

import java.io.*;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Optional;
import org.apache.commons.io.FileUtils;
import org.junit.Before;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.util.Files;

/*
 * Created by winston on 23/08/2016.
 */
public class FSGitRepoStoreTest {

  public static File makeTempRepoDir(TemporaryFolder tmpFolder, String name) throws IOException {
    File tmp = tmpFolder.newFolder(name);
    Path rootdir =
        Paths.get(
            "src/test/resources/uk/ac/ic/wlgitbridge/" + "bridge/repo/FSGitRepoStoreTest/rootdir");
    FileUtils.copyDirectory(rootdir.toFile(), tmp);
    Files.renameAll(tmp, "DOTgit", ".git");
    return tmp;
  }

  private FSGitRepoStore repoStore;
  private File original;

  @Before
  public void setup() throws IOException {
    TemporaryFolder tmpFolder = new TemporaryFolder();
    tmpFolder.create();
    File tmp = makeTempRepoDir(tmpFolder, "rootdir");
    original = tmpFolder.newFolder("original");
    FileUtils.copyDirectory(tmp, original);
    repoStore = new FSGitRepoStore(tmp.getAbsolutePath(), Optional.empty());
  }

  @Test
  public void testPurgeNonexistentProjects() {
    File toDelete = new File(repoStore.getRootDirectory(), "idontexist");
    File wlgb = new File(repoStore.getRootDirectory(), ".wlgb");
    assertTrue(toDelete.exists());
    assertTrue(wlgb.exists());
    repoStore.purgeNonexistentProjects(Arrays.asList("proj1", "proj2"));
    assertFalse(toDelete.exists());
    assertTrue(wlgb.exists());
  }

  @Test
  public void totalSizeShouldChangeWhenFilesAreCreatedAndDeleted() throws IOException {
    long old = repoStore.totalSize();
    File temp = new File(repoStore.getRootDirectory(), "__temp.txt");
    try (OutputStream out = new FileOutputStream(temp)) {
      out.write(new byte[16 * 1024 * 1024]);
    }
    long new_ = repoStore.totalSize();
    assertTrue(new_ > old);
    assertTrue(temp.delete());
    long new__ = repoStore.totalSize();
    assertTrue(new__ < new_);
  }

  @Test
  public void zipAndUnzipShouldBeTheSame() throws IOException {
    File expected = new File(original, "proj1");
    File actual = new File(repoStore.getRootDirectory(), "proj1");
    assertTrue(Files.contentsAreEqual(expected, actual));
    InputStream zipped = repoStore.bzip2Project("proj1");
    repoStore.remove("proj1");
    assertFalse(actual.exists());
    repoStore.unbzip2Project("proj1", zipped);
    assertTrue(Files.contentsAreEqual(expected, actual));
  }
}
