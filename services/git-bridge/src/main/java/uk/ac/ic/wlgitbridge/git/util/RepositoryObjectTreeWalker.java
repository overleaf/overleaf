package uk.ac.ic.wlgitbridge.git.util;

import org.eclipse.jgit.errors.LargeObjectException;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.treewalk.TreeWalk;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.git.exception.SizeLimitExceededException;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 16/11/14.
 */
public class RepositoryObjectTreeWalker {

    private final TreeWalk treeWalk;
    private final Repository repository;

    public RepositoryObjectTreeWalker(
            Repository repository,
            ObjectId objectId
    ) throws IOException {
        treeWalk = initTreeWalk(repository, objectId);
        this.repository = repository;
    }

    public RepositoryObjectTreeWalker(
            Repository repository
    ) throws IOException {
        this(repository, 0);
    }

    public RepositoryObjectTreeWalker(
            Repository repository,
            int fromHead
    ) throws IOException {
        this(repository, repository.resolve("HEAD~" + fromHead));
    }

    public RawDirectory getDirectoryContents(
    ) throws IOException, SizeLimitExceededException {
        return new RawDirectory(walkGitObjectTree());
    }

    private TreeWalk initTreeWalk(
            Repository repository,
            ObjectId objectId
    ) throws IOException {
        if (objectId == null) {
            return null;
        }
        RevWalk walk = new RevWalk(repository);
        TreeWalk treeWalk = new TreeWalk(repository);
        treeWalk.addTree(walk.parseCommit(objectId).getTree());
        treeWalk.setRecursive(true);
        return treeWalk;
    }

    private Map<String, RawFile> walkGitObjectTree(
    ) throws IOException, SizeLimitExceededException {
        Map<String, RawFile> fileContentsTable = new HashMap<>();
        if (treeWalk == null) {
            return fileContentsTable;
        }
        while (treeWalk.next()) {
            String path = treeWalk.getPathString();

            try {
                byte[] content = repository.open(
                        treeWalk.getObjectId(0)
                ).getBytes();
                fileContentsTable.put(path, new RepositoryFile(path, content));
            } catch (LargeObjectException e) {
                throw new SizeLimitExceededException(path);
            }
        }
        return fileContentsTable;
    }

}
