package uk.ac.ic.wlgitbridge.bridge.repo;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.lessThan;
import static org.junit.Assert.*;

import com.google.api.client.repackaged.com.google.common.base.Preconditions;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.function.Supplier;
import org.apache.commons.io.FileUtils;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.snapshot.servermock.util.FileUtil;
import uk.ac.ic.wlgitbridge.util.Files;

/*
 * Created by winston on 08/10/2016.
 */
public class GitProjectRepoTest {

  public static File makeTempRepoDir(TemporaryFolder tmpFolder, String name) throws IOException {
    File tmp = tmpFolder.newFolder(name);
    Path rootdir =
        Paths.get(
            "src/test/resources/uk/ac/ic/wlgitbridge/" + "bridge/repo/GitProjectRepoTest/rootdir");
    FileUtils.copyDirectory(rootdir.toFile(), tmp);
    Files.renameAll(tmp, "DOTgit", ".git");
    return tmp;
  }

  private File rootdir;
  FSGitRepoStore repoStore;
  GitProjectRepo repo;
  GitProjectRepo badGitignore;
  GitProjectRepo incoming;
  GitProjectRepo withoutIncoming;

  @Rule public TemporaryFolder tmpFolder = new TemporaryFolder();

  @Before
  public void setup() throws IOException {
    rootdir = makeTempRepoDir(tmpFolder, "rootdir");
    repoStore = new FSGitRepoStore(rootdir.getAbsolutePath(), Optional.empty());
    repo = fromExistingDir("repo");
    badGitignore = fromExistingDir("badgitignore");
    incoming = fromExistingDir("incoming");
    withoutIncoming = fromExistingDir("without_incoming");
  }

  private GitProjectRepo fromExistingDir(String dir) throws IOException {
    GitProjectRepo ret = GitProjectRepo.fromName(dir);
    ret.useExistingRepository(repoStore);
    return ret;
  }

  private GitDirectoryContents makeDirContents(String... contents) {
    Preconditions.checkArgument(contents.length % 2 == 0);
    List<RawFile> files = new ArrayList<>(contents.length / 2);
    for (int i = 0; i + 1 < contents.length; i += 2) {
      files.add(new RepositoryFile(contents[i], contents[i + 1].getBytes(StandardCharsets.UTF_8)));
    }
    return new GitDirectoryContents(
        files,
        repoStore.getRootDirectory(),
        "repo",
        "Winston Li",
        "git@winston.li",
        "Commit Message",
        new Date());
  }

  @Test
  public void deletingIgnoredFileOnAppDeletesFromTheRepo() throws IOException {
    GitDirectoryContents contents = makeDirContents(".gitignore", "*.ignored\n");
    repo.commitAndGetMissing(contents);
    repo.resetHard();
    File dir = repo.getDotGitDir();
    assertEquals(
        new HashSet<String>(Arrays.asList(".git", ".gitignore")),
        new HashSet<String>(Arrays.asList(dir.list())));
  }

  @Test
  public void addingIgnoredFilesOnAppAddsToTheRepo() throws IOException {
    GitDirectoryContents contents =
        makeDirContents(
            ".gitignore",
            "*.ignored\n",
            "file1.ignored",
            "",
            "file1.txt",
            "",
            "file2.txt",
            "",
            "added.ignored",
            "");
    repo.commitAndGetMissing(contents);
    repo.resetHard();
    assertEquals(
        new HashSet<String>(
            Arrays.asList(
                ".git", ".gitignore", "file1.ignored", "file1.txt", "file2.txt", "added.ignored")),
        new HashSet<String>(Arrays.asList(repo.getDotGitDir().list())));
  }

  @Test
  public void badGitignoreShouldNotThrow() throws IOException {
    GitDirectoryContents contents =
        makeDirContents(
            ".gitignore",
            "*.ignored\n",
            "file1.ignored",
            "",
            "file1.txt",
            "",
            "file2.txt",
            "",
            "added.ignored",
            "");
    badGitignore.commitAndGetMissing(contents);
  }

  private static long repoSize(ProjectRepo repo) {
    return FileUtils.sizeOfDirectory(repo.getProjectDir());
  }

  @Test
  public void runGCReducesTheSizeOfARepoWithGarbage() throws IOException {
    long beforeSize = repoSize(repo);
    repo.runGC();
    long afterSize = repoSize(repo);
    assertThat(beforeSize, lessThan(afterSize));
  }

  @Test
  public void runGCDoesNothingOnARepoWithoutGarbage() throws IOException {
    repo.runGC();
    long beforeSize = repoSize(repo);
    repo.runGC();
    long afterSize = repoSize(repo);
    assertThat(beforeSize, equalTo(afterSize));
  }

  @Test
  public void deleteIncomingPacksDeletesIncomingPacks() throws IOException {
    Supplier<Boolean> dirsAreEq =
        () ->
            FileUtil.directoryDeepEquals(incoming.getProjectDir(), withoutIncoming.getProjectDir());
    assertFalse(dirsAreEq.get());
    incoming.deleteIncomingPacks();
    assertTrue(dirsAreEq.get());
  }

  @Test
  public void deleteIncomingPacksOnDirWithoutIncomingPacksDoesNothing() throws IOException {
    File actual = withoutIncoming.getProjectDir();
    File expected = tmpFolder.newFolder();
    FileUtils.copyDirectory(actual, expected);
    withoutIncoming.deleteIncomingPacks();
    assertTrue(FileUtil.directoryDeepEquals(actual, expected));
  }
}
