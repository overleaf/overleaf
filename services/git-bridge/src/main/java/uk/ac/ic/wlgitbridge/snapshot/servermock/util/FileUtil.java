package uk.ac.ic.wlgitbridge.snapshot.servermock.util;

import com.google.common.collect.ImmutableSet;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.api.errors.NoHeadException;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;

/*
 * Created by Winston on 11/01/15.
 */
public class FileUtil {

  public static boolean currentCommitsAreEqual(Path dir1, Path dir2) {
    try {
      RevCommit commit1 =
          new Git(new FileRepositoryBuilder().setWorkTree(dir1.toFile().getAbsoluteFile()).build())
              .log()
              .call()
              .iterator()
              .next();
      RevCommit commit2 =
          new Git(new FileRepositoryBuilder().setWorkTree(dir2.toFile().getAbsoluteFile()).build())
              .log()
              .call()
              .iterator()
              .next();
      return commit1.equals(commit2);
    } catch (IOException e) {
      throw new RuntimeException(e);
    } catch (NoHeadException e) {
      return false;
    } catch (GitAPIException e) {
      throw new RuntimeException(e);
    }
  }

  public static boolean gitDirectoriesAreEqual(Path dir1, Path dir2) {
    Set<String> dir1Contents = getAllRecursivelyInDirectoryApartFrom(dir1, dir1.resolve(".git"));
    Set<String> dir2Contents = getAllRecursivelyInDirectoryApartFrom(dir2, dir2.resolve(".git"));
    return filesAreEqual(dir1, dir2, dir1Contents, dir2Contents);
  }

  public static boolean directoryDeepEquals(File dir, File dir_) {
    return directoryDeepEquals(dir.toPath(), dir_.toPath());
  }

  public static boolean directoryDeepEquals(Path path, Path path_) {
    List<Set<String>> contents =
        Stream.of(path, path_)
            .map(p -> getAllFilesRecursively(p, p, Collections.emptySet(), true))
            .collect(Collectors.toList());
    return filesAreEqual(path, path_, contents.get(0), contents.get(1));
  }

  private static boolean filesAreEqual(
      Path dir1, Path dir2, Set<String> dir1Contents, Set<String> dir2Contents) {
    boolean filesEqual = dir1Contents.equals(dir2Contents);
    if (!filesEqual) {
      System.out.println("Not equal: (" + dir1Contents + ", " + dir2Contents + ")");
      System.out.println(dir1 + ": " + dir1Contents);
      System.out.println(dir2 + ": " + dir2Contents);
    }
    return filesEqual && directoryContentsEqual(dir1Contents, dir1, dir2);
  }

  static boolean directoryContentsEqual(Set<String> dirContents, Path dir1, Path dir2) {
    for (String file : dirContents) {
      Path path1 = dir1.resolve(file);
      Path path2 = dir2.resolve(file);
      if (!path1.toFile().isDirectory()
          && !path2.toFile().isDirectory()
          && !fileContentsEqual(path1, path2)) {
        return false;
      }
    }
    return true;
  }

  private static boolean fileContentsEqual(Path first, Path second) {
    try {
      byte[] firstContents = Files.readAllBytes(first);
      byte[] secondContents = Files.readAllBytes(second);
      boolean equals = Arrays.equals(firstContents, secondContents);
      if (!equals) {
        System.out.println("Not equal: (" + first + ", " + second + ")");
        System.out.println(first + ": " + new String(firstContents));
        System.out.println(second + ": " + new String(secondContents));
      }
      return equals;
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  public static Set<String> getAllRecursivelyInDirectoryApartFrom(Path dir, Path excluded) {
    return getAllRecursivelyInDirectoryApartFrom(dir, excluded, true);
  }

  public static Set<String> getOnlyFilesRecursivelyInDirectoryApartFrom(Path dir, Path excluded) {
    return getAllRecursivelyInDirectoryApartFrom(dir, excluded, false);
  }

  private static Set<String> getAllRecursivelyInDirectoryApartFrom(
      Path dir, Path excluded, boolean directories) {
    if (!dir.toFile().isDirectory()) {
      throw new IllegalArgumentException("need a directory");
    }
    return getAllFilesRecursively(dir, dir, ImmutableSet.of(excluded.toFile()), directories);
  }

  private static final Set<String> ExcludedNames = ImmutableSet.of(".DS_Store");

  static Set<String> getAllFilesRecursively(
      Path baseDir, Path dir, Set<File> excluded, boolean directories) {
    Set<String> files = new HashSet<String>();
    for (File file : dir.toFile().listFiles()) {
      if (excluded.contains(file)) {
        continue;
      }
      if (ExcludedNames.contains(file.getName())) {
        continue;
      }
      boolean isDirectory = file.isDirectory();
      if (directories || !isDirectory) {
        files.add(baseDir.relativize(file.toPath()).toString());
      }
      if (isDirectory) {
        files.addAll(getAllFilesRecursively(baseDir, file.toPath(), excluded, directories));
      }
    }
    return files;
  }
}
