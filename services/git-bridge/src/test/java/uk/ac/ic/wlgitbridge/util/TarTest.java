package uk.ac.ic.wlgitbridge.util;

import org.apache.commons.io.FileUtils;
import org.junit.Before;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.Assert.assertTrue;

/**
 * Created by winston on 23/08/2016.
 */
public class TarTest {

    private File testDir;

    @Before
    public void setup() throws IOException {
        TemporaryFolder tmpFolder = new TemporaryFolder();
        tmpFolder.create();
        testDir = tmpFolder.newFolder("testdir");
        Path resdir = Paths.get(
                "src/test/resources/uk/ac/ic/wlgitbridge/util/TarTest/testdir"
        );
        FileUtils.copyDirectory(resdir.toFile(), testDir);
    }

    @Test
    public void tarAndUntarProducesTheSameResult() throws IOException {
        InputStream tar = Tar.tar(testDir);
        TemporaryFolder tmpF = new TemporaryFolder();
        tmpF.create();
        File parentDir = tmpF.newFolder();
        Tar.untar(tar, parentDir);
        File untarred = new File(parentDir, "testdir");
        assertTrue(Files.contentsAreEqual(testDir, untarred));
    }

}