package uk.ac.ic.wlgitbridge.bridge.swap.store;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import org.apache.commons.io.IOUtils;

/*
 * Created by winston on 23/08/2016.
 */
public class InMemorySwapStore implements SwapStore {

  private final Map<String, byte[]> store;

  public InMemorySwapStore() {
    store = new HashMap<>();
  }

  public InMemorySwapStore(SwapStoreConfig __) {
    this();
  }

  @Override
  public void upload(String projectName, InputStream uploadStream, long contentLength)
      throws IOException {
    store.put(projectName, IOUtils.toByteArray(uploadStream, contentLength));
  }

  @Override
  public InputStream openDownloadStream(String projectName) {
    byte[] buf = store.get(projectName);
    if (buf == null) {
      throw new IllegalArgumentException("no such project in swap store: " + projectName);
    }
    return new ByteArrayInputStream(buf);
  }

  @Override
  public void remove(String projectName) {
    store.remove(projectName);
  }

  @Override
  public boolean isSafe() {
    return false;
  }
}
