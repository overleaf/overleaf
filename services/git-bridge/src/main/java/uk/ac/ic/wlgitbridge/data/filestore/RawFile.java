package uk.ac.ic.wlgitbridge.data.filestore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 16/11/14.
 */
public abstract class RawFile {

  public abstract String getPath();

  public abstract byte[] getContents();

  public abstract long size();

  public final void writeToDisk(File directory) throws IOException {
    writeToDiskWithName(directory, getPath());
  }

  public final void writeToDiskWithName(File directory, String name) throws IOException {
    File file = new File(directory, name);
    file.getParentFile().mkdirs();
    file.createNewFile();
    OutputStream out = new FileOutputStream(file);
    out.write(getContents());
    out.close();
    Log.debug("Wrote file: {}", file.getAbsolutePath());
  }

  @Override
  public boolean equals(Object obj) {
    if (!(obj instanceof RawFile)) {
      return false;
    }
    RawFile that = (RawFile) obj;
    return getPath().equals(that.getPath()) && Arrays.equals(getContents(), that.getContents());
  }
}
