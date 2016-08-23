package uk.ac.ic.wlgitbridge.bridge.repo;

import org.apache.commons.io.FileUtils;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.util.Files;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;

import static org.junit.Assert.assertEquals;

/**
 * Created by winston on 23/08/2016.
 */
public class FSRepoStoreTest {

    private FSRepoStore repoStore;
    private File original;

    @Before
    public void setup() throws IOException {
        TemporaryFolder tmpFolder = new TemporaryFolder();
        tmpFolder.create();
        File tmp = tmpFolder.newFolder("repostore");
        Path rootdir = Paths.get(
                "src/test/resources/uk/ac/ic/wlgitbridge/"
                        + "bridge/repo/FSRepoStoreTest/rootdir"
        );
        FileUtils.copyDirectory(rootdir.toFile(), tmp);
        Files.renameAll(tmp, "DOTgit", ".git");
        original = tmpFolder.newFolder("original");
        FileUtils.copyDirectory(tmp, original);
        repoStore = new FSRepoStore(tmp.getAbsolutePath());
    }

    @Test
    public void testPurgeNonexistentProjects() {
        File toDelete = new File(repoStore.getRootDirectory(), "idontexist");
        File wlgb = new File(repoStore.getRootDirectory(), ".wlgb");
        Assert.assertTrue(toDelete.exists());
        Assert.assertTrue(wlgb.exists());
        repoStore.purgeNonexistentProjects(Arrays.asList("proj1", "proj2"));
        Assert.assertFalse(toDelete.exists());
        Assert.assertTrue(wlgb.exists());
    }

    @Test
    public void testTotalSize() {
        assertEquals(31860, repoStore.totalSize());
    }

    @Test
    public void zipAndUnzipShouldBeTheSame() throws IOException {
        long beforeSize = repoStore.totalSize();
        InputStream zipped = repoStore.bzip2Project("proj1");
        repoStore.remove("proj1");
        Assert.assertTrue(beforeSize > repoStore.totalSize());
        repoStore.unbzip2Project("proj1", zipped);
        Assert.assertEquals(beforeSize, repoStore.totalSize());
        Assert.assertTrue(
                Files.contentsAreEqual(
                        original,
                        repoStore.getRootDirectory()
                )
        );
    }

}