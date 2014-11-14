package uk.ac.ic.wlgitbridge.writelatex.filestore.store;

import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.WLDirectoryNode;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProject;

import java.util.*;

/**
 * Created by Winston on 08/11/14.
 */
public class WLFileStore {

    private final Map<String, WLDirectoryNode> fileStore;
    private final String rootGitDirectoryPath;

    public WLFileStore(String rootGitDirectoryPath) {
        fileStore = new HashMap<String, WLDirectoryNode>();
        this.rootGitDirectoryPath = rootGitDirectoryPath;
    }

    public List<WritableRepositoryContents> updateForProject(WLProject project) throws FailedConnectionException,
                                                                                       InvalidProjectException {
        SortedSet<Snapshot> snapshots = project.fetchNewSnapshots();
        String projectName = project.getName();
        WLDirectoryNode directoryNode = getDirectoryNodeForProjectName(projectName);
        List<WritableRepositoryContents> writableRepositories = new LinkedList<WritableRepositoryContents>();
        for (Snapshot snapshot : snapshots) {
            writableRepositories.add(new GitDirectoryContents(directoryNode.updateFromSnapshot(snapshot),
                                                              rootGitDirectoryPath,
                                                              snapshot));
        }
        return writableRepositories;
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
