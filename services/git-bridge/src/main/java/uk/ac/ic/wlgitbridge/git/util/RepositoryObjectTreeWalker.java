package uk.ac.ic.wlgitbridge.git.util;

import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.treewalk.TreeWalk;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 16/11/14.
 */
public class RepositoryObjectTreeWalker {

    private final TreeWalk treeWalk;
    private final Repository repository;

    public RepositoryObjectTreeWalker(Repository repository, ObjectId objectId) throws IOException {
        treeWalk = initTreeWalk(repository, objectId);
        this.repository = repository;
    }

    public RawDirectoryContents getDirectoryContents() throws IOException {
        return new FileDirectoryContents(walkGitObjectTree());
    }

    private TreeWalk initTreeWalk(Repository repository, ObjectId objectId) throws IOException {
        RevWalk walk = new RevWalk(repository);
        TreeWalk treeWalk = new TreeWalk(repository);
        treeWalk.addTree(walk.parseCommit(objectId).getTree());
        treeWalk.setRecursive(true);
        return treeWalk;
    }

    private Map<String, byte[]> walkGitObjectTree() throws IOException {
        Map<String, byte[]> fileContentsTable = new HashMap<String, byte[]>();
        while (treeWalk.next()) {
            fileContentsTable.put(treeWalk.getPathString(), repository.open(treeWalk.getObjectId(0)).getBytes());
        }
        return fileContentsTable;
    }

}
