package uk.ac.ic.wlgitbridge.bridge.swap.store;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

/*
 * Created by winston on 24/08/2016.
 */
public class NoopSwapStore implements SwapStore {

  public NoopSwapStore(SwapStoreConfig __) {}

  @Override
  public void upload(String projectName, InputStream uploadStream, long contentLength) {}

  @Override
  public InputStream openDownloadStream(String projectName) {
    return new ByteArrayInputStream(new byte[0]);
  }

  @Override
  public void remove(String projectName) {}

  @Override
  public boolean isSafe() {
    return false;
  }
}
