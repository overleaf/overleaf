package uk.ac.ic.wlgitbridge.test.util;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.api.errors.NoHeadException;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Created by Winston on 11/01/15.
 */
public class FileUtil {

    public static boolean currentCommitsAreEqual(Path dir1, Path dir2) {
        try {
            RevCommit commit1 = new Git(new FileRepositoryBuilder().setWorkTree(dir1.toFile().getAbsoluteFile()).build()).log().call().iterator().next();
            RevCommit commit2 = new Git(new FileRepositoryBuilder().setWorkTree(dir2.toFile().getAbsoluteFile()).build()).log().call().iterator().next();
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
        Set<String> dir1Contents = getAllFilesRecursivelyInDirectoryApartFrom(dir1, dir1.resolve(".git"));
        Set<String> dir2Contents = getAllFilesRecursivelyInDirectoryApartFrom(dir2, dir2.resolve(".git"));
        return dir1Contents.equals(dir2Contents) && directoryContentsEqual(dir1Contents, dir1, dir2);
    }

    static boolean directoryContentsEqual(Set<String> dirContents, Path dir1, Path dir2) {
        for (String file : dirContents) {
            Path path1 = dir1.resolve(file);
            Path path2 = dir2.resolve(file);
            if (!path1.toFile().isDirectory() && !path2.toFile().isDirectory() && !fileContentsEqual(path1, path2)) {
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
//                System.out.println("Not equal: (" + first + ", " + second + ")");
//                System.out.println(first + ": " + new String(firstContents));
//                System.out.println(second + ": " + new String(secondContents));
            }
            return equals;
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public static Set<String> getAllFilesRecursivelyInDirectoryApartFrom(Path dir, Path excluded) {
        if (!dir.toFile().isDirectory()) {
            throw new IllegalArgumentException("need a directory");
        }
        return getAllFilesRecursively(dir, dir, excluded);
    }

    static Set<String> getAllFilesRecursively(Path baseDir, Path dir, Path excluded) {
        Set<String> files = new HashSet<String>();
        for (File file : dir.toFile().listFiles()) {
            if (!file.equals(excluded.toFile())) {
                files.add(baseDir.relativize(file.toPath()).toString());
                if (file.isDirectory()) {
                    files.addAll(getAllFilesRecursively(baseDir, file.toPath(), excluded));
                }
            }
        }
        return files;
    }

}
