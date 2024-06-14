package uk.ac.ic.wlgitbridge.util;

import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import org.junit.Before;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/*
 * Created by winston on 23/08/2016.
 */
public class TarTest {

  private static final String RESOURCE_DIR = "/uk/ac/ic/wlgitbridge/util/TarTest";

  private File testDir;
  private File dirWithEmptyFile;
  private File tmpDir;

  @Before
  public void setup() throws IOException {
    TemporaryFolder tmpFolder = new TemporaryFolder();
    tmpFolder.create();
    testDir = ResourceUtil.copyOfFolderResource(RESOURCE_DIR + "/testdir", tmpFolder::newFolder);
    dirWithEmptyFile =
        ResourceUtil.copyOfFolderResource(
            RESOURCE_DIR + "/dir_with_empty_file", tmpFolder::newFolder);
    tmpDir = tmpFolder.newFolder();
  }

  /*
   * Compresses inputDir and decompresses to outputDir. Checks equality
   * between outputDir and inputDir.
   * @param inputDir the directory to compress
   * @param outputDir the output directory. Must be empty.
   * @param compressFunction compression function
   * @param decompressFunction decompression function
   * @throws IOException
   */
  private static void assertCompDecompEqual(
      File inputDir,
      File outputDir,
      FunctionT<File, InputStream, IOException> compressFunction,
      BiConsumerT<InputStream, File, IOException> decompressFunction)
      throws IOException {
    try (InputStream tarbz2 = compressFunction.apply(inputDir)) {
      decompressFunction.accept(tarbz2, outputDir);
      File unzipped = new File(outputDir, inputDir.getName());
      assertTrue(Files.contentsAreEqual(inputDir, unzipped));
    }
  }

  @Test
  public void tarAndUntarProducesTheSameResult() throws IOException {
    assertCompDecompEqual(testDir, tmpDir, Tar::tar, Tar::untar);
  }

  @Test
  public void tarbz2AndUntarbz2ProducesTheSameResult() throws IOException {
    assertCompDecompEqual(testDir, tmpDir, Tar.bz2::zip, Tar.bz2::unzip);
  }

  @Test
  public void tarbz2WorksOnDirectoriesWithAnEmptyFile() throws IOException {
    assertCompDecompEqual(dirWithEmptyFile, tmpDir, Tar.bz2::zip, Tar.bz2::unzip);
  }
}
