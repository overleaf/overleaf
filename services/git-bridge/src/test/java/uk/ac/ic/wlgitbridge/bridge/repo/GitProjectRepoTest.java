package uk.ac.ic.wlgitbridge.bridge.repo;

import com.google.api.client.repackaged.com.google.common.base.Preconditions;
import org.apache.commons.io.FileUtils;
import org.junit.Before;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.util.Files;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

import static org.junit.Assert.assertEquals;

/**
 * Created by winston on 08/10/2016.
 */
public class GitProjectRepoTest {

    public static File makeTempRepoDir(
            TemporaryFolder tmpFolder,
            String name
    ) throws IOException {
        File tmp = tmpFolder.newFolder(name);
        Path rootdir = Paths.get(
                "src/test/resources/uk/ac/ic/wlgitbridge/"
                        + "bridge/repo/GitProjectRepoTest/rootdir"
        );
        FileUtils.copyDirectory(rootdir.toFile(), tmp);
        Files.renameAll(tmp, "DOTgit", ".git");
        return tmp;
    }

    private File rootdir;
    FSGitRepoStore repoStore;
    GitProjectRepo repo;

    @Before
    public void setup() throws IOException {
        TemporaryFolder tmpFolder = new TemporaryFolder();
        tmpFolder.create();
        rootdir = makeTempRepoDir(tmpFolder, "rootdir");
        repoStore = new FSGitRepoStore(rootdir.getAbsolutePath());
        repo = new GitProjectRepo("repo");
        repo.useExistingRepository(repoStore);
    }

    private GitDirectoryContents makeDirContents(
            String... contents
    ) {
        Preconditions.checkArgument(contents.length % 2 == 0);
        List<RawFile> files = new ArrayList<>(contents.length / 2);
        for (int i = 0; i + 1 < contents.length; i += 2) {
            files.add(
                    new RepositoryFile(
                            contents[i],
                            contents[i + 1].getBytes(StandardCharsets.UTF_8)
                    )
            );
        }
        return new GitDirectoryContents(
                files,
                repoStore.getRootDirectory(),
                "repo",
                "Winston Li",
                "git@winston.li",
                "Commit Message",
                new Date()
        );
    }

    @Test
    public void deletingIgnoredFileOnAppDeletesFromTheRepo(
    ) throws IOException {
        GitDirectoryContents contents = makeDirContents(
                ".gitignore",
                "*.ignored\n"
        );
        repo.commitAndGetMissing(contents);
        repo.resetHard();
        File dir = repo.getDirectory();
        assertEquals(
                new HashSet<String>(Arrays.asList(".git", ".gitignore")),
                new HashSet<String>(Arrays.asList(dir.list()))
        );
    }

    @Test
    public void addingIgnoredFilesOnAppAddsToTheRepo() throws IOException {
        GitDirectoryContents contents = makeDirContents(
                ".gitignore",
                "*.ignored\n",
                "file1.ignored",
                "",
                "file1.txt",
                "",
                "file2.txt",
                "",
                "added.ignored",
                ""
        );
        repo.commitAndGetMissing(contents);
        repo.resetHard();
        assertEquals(
                new HashSet<String>(Arrays.asList(
                        ".git",
                        ".gitignore",
                        "file1.ignored",
                        "file1.txt",
                        "file2.txt",
                        "added.ignored"
                )),
                new HashSet<String>(Arrays.asList(repo.getDirectory().list()))
        );
    }

}
