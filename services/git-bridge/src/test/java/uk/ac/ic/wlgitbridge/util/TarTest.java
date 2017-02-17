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
    private File tmpDir;

    @Before
    public void setup() throws IOException {
        TemporaryFolder tmpFolder = new TemporaryFolder();
        tmpFolder.create();
        testDir = tmpFolder.newFolder("testdir");
        Path resdir = Paths.get(
                "src/test/resources/uk/ac/ic/wlgitbridge/util/TarTest/testdir"
        );
        FileUtils.copyDirectory(resdir.toFile(), testDir);
        tmpDir = tmpFolder.newFolder();
    }

    @Test
    public void tarAndUntarProducesTheSameResult() throws IOException {
        try (InputStream tar = Tar.tar(testDir)) {
            Tar.untar(tar, tmpDir);
            File untarred = new File(tmpDir, "testdir");
            assertTrue(Files.contentsAreEqual(testDir, untarred));
        }
    }

    @Test
    public void tarbz2AndUntarbz2ProducesTheSameResult() throws IOException {
        try (InputStream tarbz2 = Tar.bz2.zip(testDir)) {
            Tar.bz2.unzip(tarbz2, tmpDir);
            File unzipped = new File(tmpDir, "testdir");
            assertTrue(Files.contentsAreEqual(testDir, unzipped));
        }
    }

}