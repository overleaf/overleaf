package uk.ac.ic.wlgitbridge.util;

import com.google.api.client.repackaged.com.google.common.base.Preconditions;
import java.io.File;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.filefilter.TrueFileFilter;

/*
 * Created by winston on 23/08/2016.
 */
public class Files {

  private Files() {}

  public static boolean contentsAreEqual(File f0, File f1) throws IOException {
    try {
      return uncheckedContentsAreEqual(f0, f1);
    } catch (UncheckedIOException e) {
      throw e.getCause();
    }
  }

  public static void renameAll(File fileOrDir, String from, String to) {
    if (fileOrDir.isDirectory()) {
      File f = doRename(fileOrDir, from, to);
      for (File c : f.listFiles()) {
        renameAll(c, from, to);
      }
    } else if (fileOrDir.isFile()) {
      doRename(fileOrDir, from, to);
    } else {
      throw new IllegalArgumentException("not a file or dir: " + fileOrDir);
    }
  }

  private static File doRename(File fileOrDir, String from, String to) {
    if (!fileOrDir.getName().equals(from)) {
      return fileOrDir;
    }
    File renamed = new File(fileOrDir.getParent(), to);
    Preconditions.checkState(fileOrDir.renameTo(renamed));
    return renamed;
  }

  private static boolean uncheckedContentsAreEqual(File f0, File f1) throws IOException {
    if (f0.equals(f1)) {
      return true;
    }
    if (!f0.isDirectory() || !f1.isDirectory()) {
      return !f0.isDirectory()
          && !f1.isDirectory()
          && Arrays.equals(FileUtils.readFileToByteArray(f0), FileUtils.readFileToByteArray(f1));
    }
    Path f0Base = Paths.get(f0.getAbsolutePath());
    Path f1Base = Paths.get(f1.getAbsolutePath());
    Set<Path> children0 = getChildren(f0, f0Base);
    Set<Path> children1 = getChildren(f1, f1Base);
    if (children0.size() != children1.size()) {
      return false;
    }
    return children0.stream()
        .allMatch(c0 -> children1.contains(c0) && childEquals(c0, f0Base, f1Base));
  }

  private static Set<Path> getChildren(File f0, Path f0Base) {
    return FileUtils.listFilesAndDirs(f0, TrueFileFilter.TRUE, TrueFileFilter.TRUE).stream()
        .map(File::getAbsolutePath)
        .map(Paths::get)
        .map(p -> f0Base.relativize(p))
        .filter(p -> !p.toString().isEmpty())
        .collect(Collectors.toSet());
  }

  private static boolean childEquals(Path child, Path f0Base, Path f1Base)
      throws UncheckedIOException {
    File c0 = f0Base.resolve(child).toFile();
    File c1 = f1Base.resolve(child).toFile();
    boolean c0IsDir = c0.isDirectory();
    boolean c1IsDir = c1.isDirectory();
    if (c0IsDir || c1IsDir) {
      return c0IsDir && c1IsDir;
    }
    try {
      return c0.isFile()
          && c1.isFile()
          && Arrays.equals(FileUtils.readFileToByteArray(c0), FileUtils.readFileToByteArray(c1));
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
