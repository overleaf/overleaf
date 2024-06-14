package uk.ac.ic.wlgitbridge.data.filestore;

/*
 * Created by Winston on 16/11/14.
 */
public class RepositoryFile extends RawFile {

  private final String path;
  private final byte[] contents;

  public RepositoryFile(String path, byte[] contents) {
    this.path = path;
    this.contents = contents;
  }

  @Override
  public String getPath() {
    return path;
  }

  @Override
  public byte[] getContents() {
    return contents;
  }

  @Override
  public long size() {
    return contents.length;
  }
}
