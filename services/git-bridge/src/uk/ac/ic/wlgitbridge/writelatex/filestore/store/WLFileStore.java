package uk.ac.ic.wlgitbridge.writelatex.filestore.store;

import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.WLDirectoryNode;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProject;

import java.io.File;
import java.util.*;

/**
 * Created by Winston on 08/11/14.
 */
public class WLFileStore {

    private final Map<String, WLDirectoryNode> fileStore;
    private final File rootGitDirectory;

    public WLFileStore(String rootGitDirectoryPath) {
        fileStore = new HashMap<String, WLDirectoryNode>();
        rootGitDirectory = new File(rootGitDirectoryPath);
        rootGitDirectory.mkdirs();
        deleteInDirectory(rootGitDirectory);
    }

    public static void deleteInDirectory(File directory) {
        for (File file : directory.listFiles()) {
            if (file.isDirectory()) {
                deleteInDirectory(file);
            }
            file.delete();
        }
    }

    public List<WritableRepositoryContents> updateForProject(WLProject project) throws FailedConnectionException,
                                                                                       InvalidProjectException {
        SortedSet<Snapshot> snapshots = project.fetchNewSnapshots();
        String projectName = project.getName();
        WLDirectoryNode directoryNode = getDirectoryNodeForProjectName(projectName);
        List<WritableRepositoryContents> writableRepositories = new LinkedList<WritableRepositoryContents>();
        for (Snapshot snapshot : snapshots) {
            writableRepositories.add(new GitDirectoryContents(directoryNode.updateFromSnapshot(snapshot),
                                                              rootGitDirectory,
                                                              projectName,
                                                              snapshot));
        }
        return writableRepositories;
    }

    public WLDirectoryNode createCandidateDirectoryNodeForProjectWithContents(WLProject project, RawDirectoryContents directoryContents) {
        return getDirectoryNodeForProjectName(project.getName()).createFromRawDirectoryContents(directoryContents);
    }

    private WLDirectoryNode getDirectoryNodeForProjectName(String projectName) {
        WLDirectoryNode directoryNode = fileStore.get(projectName);
        if (directoryNode == null) {
            directoryNode = new WLDirectoryNode();
            fileStore.put(projectName, directoryNode);
        }
        return directoryNode;
    }

}
