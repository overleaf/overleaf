package uk.ac.ic.wlgitbridge.data;

import java.util.UUID;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;

/*
 * Created by Winston on 21/02/15.
 */
public class ServletFile extends RawFile {

  private final RawFile file;
  private final boolean changed;
  private String uuid;

  public ServletFile(RawFile file, RawFile oldFile) {
    this.file = file;
    this.uuid = UUID.randomUUID().toString();
    changed = !equals(oldFile);
  }

  public String getUniqueIdentifier() {
    return uuid;
  }

  @Override
  public String getPath() {
    return file.getPath();
  }

  @Override
  public byte[] getContents() {
    return file.getContents();
  }

  @Override
  public long size() {
    return getContents().length;
  }

  public boolean isChanged() {
    return changed;
  }

  @Override
  public String toString() {
    return getPath();
  }
}
