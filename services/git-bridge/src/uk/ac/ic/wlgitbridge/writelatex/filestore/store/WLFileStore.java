package uk.ac.ic.wlgitbridge.writelatex.filestore.store;

import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.WLDirectoryNode;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProject;

import java.io.File;
import java.io.IOException;
import java.util.*;

/**
 * Created by Winston on 08/11/14.
 */
public class WLFileStore {

    private final Map<String, WLDirectoryNode> fileStore;
    private final File rootGitDirectory;
    private final File attDirectory;

    public WLFileStore(String rootGitDirectoryPath) {
        fileStore = new HashMap<String, WLDirectoryNode>();
        rootGitDirectory = new File(rootGitDirectoryPath);
        rootGitDirectory.mkdirs();
        deleteInDirectory(rootGitDirectory);
        attDirectory = new File(rootGitDirectory, ".wlgb/atts");
        attDirectory.mkdirs();
    }

    public static void deleteInDirectory(File directory) {
        for (File file : directory.listFiles()) {
            if (file.isDirectory()) {
                deleteInDirectory(file);
            }
            file.delete();
        }
    }

    public static void deleteInDirectoryApartFrom(File directory, String apartFrom) {
        for (File file : directory.listFiles()) {
            if (!file.getName().equals(apartFrom)) {
                if (file.isDirectory()) {
                    deleteInDirectory(file);
                }
                file.delete();
            }
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

    public WLDirectoryNode createNextDirectoryNodeInProjectFromContents(WLProject project, RawDirectoryContents directoryContents) throws IOException, FailedConnectionException {
        return getDirectoryNodeForProjectName(project.getName()).createFromRawDirectoryContents(directoryContents, attDirectory);
    }

    public void approveCandidateSnapshot(CandidateSnapshot candidateSnapshot) {
        fileStore.put(candidateSnapshot.getProjectName(), candidateSnapshot.getDirectoryNode());
    }

    private WLDirectoryNode getDirectoryNodeForProjectName(String projectName) {
        WLDirectoryNode directoryNode = fileStore.get(projectName);
        if (directoryNode == null) {
            directoryNode = new WLDirectoryNode(projectName);
            fileStore.put(projectName, directoryNode);
        }
        return directoryNode;
    }

}
