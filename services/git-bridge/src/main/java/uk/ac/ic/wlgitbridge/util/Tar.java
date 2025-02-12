package uk.ac.ic.wlgitbridge.util;

import com.google.api.client.repackaged.com.google.common.base.Preconditions;
import java.io.*;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.apache.commons.compress.archivers.ArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream;
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorOutputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream;
import org.apache.commons.compress.utils.IOUtils;

/*
 * Tar utilities.
 *
 * The resource returned by zip and tar are treated as unowned.
 *
 * The resource given to unzip is treated as unowned.
 *
 * Caller is responsible for all resources.
 */
public class Tar {
  public static class gzip {

    public static InputStream zip(File fileOrDir) throws IOException {
      return zip(fileOrDir, null);
    }

    public static InputStream zip(File fileOrDir, long[] sizePtr) throws IOException {
      File tmp = File.createTempFile(fileOrDir.getName(), ".tar.gz");
      tmp.deleteOnExit();
      OutputStream target = new FileOutputStream(tmp);
      /* Closes target */
      try (OutputStream gz = new GzipCompressorOutputStream(target)) {
        tarTo(fileOrDir, gz);
      } catch (IOException e) {
        tmp.delete();
        throw e;
      }
      if (sizePtr != null) {
        sizePtr[0] = tmp.length();
      }
      return new DeletingFileInputStream(tmp);
    }

    public static void unzip(InputStream targz, File parentDir) throws IOException {
      /* GzipCompressorInputStream does not need closing
      Closing it would close targz which we should not do */
      InputStream tar = new GzipCompressorInputStream(targz);
      untar(tar, parentDir);
    }
  }

  public static class bz2 {

    public static InputStream zip(File fileOrDir) throws IOException {
      return zip(fileOrDir, null);
    }

    public static InputStream zip(File fileOrDir, long[] sizePtr) throws IOException {
      File tmp = File.createTempFile(fileOrDir.getName(), ".tar.bz2");
      tmp.deleteOnExit();
      OutputStream target = new FileOutputStream(tmp);
      /* Closes target */
      try (OutputStream bzip2 = new BZip2CompressorOutputStream(target)) {
        tarTo(fileOrDir, bzip2);
      } catch (IOException e) {
        tmp.delete();
        throw e;
      }
      if (sizePtr != null) {
        sizePtr[0] = tmp.length();
      }
      return new DeletingFileInputStream(tmp);
    }

    public static void unzip(InputStream tarbz2, File parentDir) throws IOException {
      /* BZip2CompressorInputStream does not need closing
      Closing it would close tarbz2 which we should not do */
      InputStream tar = new BZip2CompressorInputStream(tarbz2);
      untar(tar, parentDir);
    }
  }

  private Tar() {}

  public static InputStream tar(File fileOrDir) throws IOException {
    File tmp = File.createTempFile(fileOrDir.getName(), ".tar");
    tmp.deleteOnExit();
    try (FileOutputStream target = new FileOutputStream(tmp)) {
      tarTo(fileOrDir, target);
      return new DeletingFileInputStream(tmp);
    } catch (IOException e) {
      tmp.delete();
      throw e;
    }
  }

  public static void tarTo(File fileOrDir, OutputStream target) throws IOException {
    try (TarArchiveOutputStream tout = new TarArchiveOutputStream(target)) {
      addTarEntry(tout, Paths.get(fileOrDir.getParentFile().getAbsolutePath()), fileOrDir);
    }
  }

  public static void untar(InputStream tar, File parentDir) throws IOException {
    TarArchiveInputStream tin = new TarArchiveInputStream(tar);
    ArchiveEntry e;
    while ((e = tin.getNextEntry()) != null) {
      File f = new File(parentDir, e.getName());
      f.setLastModified(e.getLastModifiedDate().getTime());
      f.getParentFile().mkdirs();
      if (e.isDirectory()) {
        f.mkdir();
        continue;
      }
      long size = e.getSize();
      checkFileSize(size);
      try (OutputStream out = new FileOutputStream(f)) {
        /* TarInputStream pretends each
        entry's EOF is the stream's EOF */
        IOUtils.copy(tin, out);
      }
    }
  }

  private static void checkFileSize(long size) {
    Preconditions.checkArgument(
        size >= 0 && size <= Integer.MAX_VALUE,
        "file too big (" + size + " B): " + "tarTo should have thrown an IOException");
  }

  private static void addTarEntry(TarArchiveOutputStream tout, Path base, File fileOrDir)
      throws IOException {
    if (fileOrDir.isDirectory()) {
      addTarDir(tout, base, fileOrDir);
    } else if (fileOrDir.isFile()) {
      addTarFile(tout, base, fileOrDir);
    } else {
      throw new IllegalArgumentException("invalid file or dir: " + fileOrDir);
    }
  }

  private static void addTarDir(TarArchiveOutputStream tout, Path base, File dir)
      throws IOException {
    Preconditions.checkArgument(dir.isDirectory());
    String name = base.relativize(Paths.get(dir.getAbsolutePath())).toString();
    TarArchiveEntry entry = tout.createArchiveEntry(dir, name);
    tout.putArchiveEntry(entry);
    tout.closeArchiveEntry();
    for (File f : dir.listFiles()) {
      addTarEntry(tout, base, f);
    }
  }

  private static void addTarFile(TarArchiveOutputStream tout, Path base, File file)
      throws IOException {
    Preconditions.checkArgument(file.isFile(), "given file" + " is not file: %s", file);
    checkFileSize(file.length());
    String name = base.relativize(Paths.get(file.getAbsolutePath())).toString();
    TarArchiveEntry entry = tout.createArchiveEntry(file, name);
    tout.putArchiveEntry(entry);
    try (InputStream in = new FileInputStream(file)) {
      IOUtils.copy(in, tout);
    }
    tout.closeArchiveEntry();
  }
}
