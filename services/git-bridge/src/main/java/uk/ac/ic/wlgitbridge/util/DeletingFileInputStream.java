package uk.ac.ic.wlgitbridge.util;

import java.io.*;

/*
 * A {@link java.io.FileInputStream} which deletes the underlying
 * {@link java.io.File} on close.
 *
 * @author Michael Walker (barrucadu) {@literal <mike@barrucadu.co.uk>}
 */
public class DeletingFileInputStream extends FileInputStream {
  private File file;

  /*
   * Creates a {@link java.io.FileInputStream} by opening a
   * connection to an actual file, the file named by the
   * {@link java.io.File} object file in the file system.
   *
   * When the {@link close} method is called, the {@code File} will
   * be deleted.
   */
  public DeletingFileInputStream(File file) throws FileNotFoundException {
    super(file);
    this.file = file;
  }

  /*
   * Closes this input stream and deletes the underlying file.
   */
  @Override
  public void close() throws IOException {
    try {
      super.close();
    } finally {
      if (file != null) {
        file.delete();
        file = null;
      }
    }
  }

  /*
   * We shouldn't rely on this for correctness!
   */
  @Override
  protected void finalize() throws Throwable {
    try {
      super.finalize();
    } finally {
      if (file != null) {
        Log.warn("File open at finalization time: {}", file.getCanonicalPath());
        try {
          close();
        } catch (IOException e) {
          Log.error("Failed to delete file", e);
        }
      }
    }
  }
}
