package uk.ac.ic.wlgitbridge.bridge.swap.store;

import static org.junit.Assert.assertArrayEquals;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import org.apache.commons.io.IOUtils;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;

/*
 * Created by winston on 23/08/2016.
 */
public class InMemorySwapStoreTest {

  private final InMemorySwapStore swapStore = new InMemorySwapStore();

  @Rule public final ExpectedException exception = ExpectedException.none();

  @Test
  public void downloadingNonExistentFileThrows() {
    exception.expect(IllegalArgumentException.class);
    swapStore.openDownloadStream("asdf");
  }

  @Test
  public void canDownloadUploadedFiles() throws IOException {
    byte[] proj1Contents = "helloproj1".getBytes();
    byte[] proj2Contents = "asdfproj2".getBytes();
    swapStore.upload("proj1", new ByteArrayInputStream(proj1Contents), proj1Contents.length);
    swapStore.upload("proj2", new ByteArrayInputStream(proj2Contents), proj2Contents.length);
    assertArrayEquals(proj1Contents, IOUtils.toByteArray(swapStore.openDownloadStream("proj1")));
    assertArrayEquals(proj2Contents, IOUtils.toByteArray(swapStore.openDownloadStream("proj2")));
  }

  @Test
  public void uploadingForTheSameProjectOverwritesTheFile() throws IOException {
    byte[] proj1Contents = "helloproj1".getBytes();
    byte[] proj1NewContents = "goodbyeproj1".getBytes();
    swapStore.upload("proj1", new ByteArrayInputStream(proj1Contents), proj1Contents.length);
    assertArrayEquals(proj1Contents, IOUtils.toByteArray(swapStore.openDownloadStream("proj1")));
    swapStore.upload("proj1", new ByteArrayInputStream(proj1NewContents), proj1NewContents.length);
    assertArrayEquals(proj1NewContents, IOUtils.toByteArray(swapStore.openDownloadStream("proj1")));
  }

  @Test
  public void canRemoveFiles() throws IOException {
    byte[] projContents = "total garbage".getBytes();
    swapStore.upload("proj", new ByteArrayInputStream(projContents), projContents.length);
    assertArrayEquals(projContents, IOUtils.toByteArray(swapStore.openDownloadStream("proj")));
    swapStore.remove("proj");
    exception.expect(IllegalArgumentException.class);
    swapStore.openDownloadStream("proj");
  }
}
