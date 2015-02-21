package uk.ac.ic.wlgitbridge.writelatex.filestore.store;

import uk.ac.ic.wlgitbridge.bridge.bullshit;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.WLDirectoryNode;

import java.io.File;
import java.util.*;

/**
 * Created by Winston on 08/11/14.
 */
public class WLFileStore /*implements PersistentStoreSource*/ {

    private final Map<String, WLDirectoryNode> fileStore;
    private final File rootGitDirectory;
    private final File attDirectory;

//    private PersistentStoreAPI persistentStore;

    public WLFileStore(File rootGitDirectory) {
        fileStore = new HashMap<String, WLDirectoryNode>();
        this.rootGitDirectory = rootGitDirectory;
        attDirectory = new File(rootGitDirectory, ".wlgb/atts");
        attDirectory.mkdirs();
    }

//    public WLFileStore(File rootGitDirectory, PersistentStoreAPI persistentStoreAPI) {
//        this(rootGitDirectory);
//        initFromPersistentStore(persistentStoreAPI);
//    }

//    @Override
//    public void initFromPersistentStore(PersistentStoreAPI persistentStore) {
//        this.persistentStore = persistentStore;
//        for (String projectName : persistentStore.getProjectNames()) {
//            fileStore.put(projectName, new WLDirectoryNode(projectName, attDirectory, rootGitDirectory, persistentStore));
//        }
//    }

    public static void deleteInDirectory(File directory) {
        deleteInDirectoryApartFrom(directory);
    }

    public static void deleteInDirectoryApartFrom(File directory, String... apartFrom) {
        Set<String> excluded = new HashSet<String>(Arrays.asList(apartFrom));
        for (File file : directory.listFiles()) {
            if (!excluded.contains(file.getName())) {
                if (file.isDirectory()) {
                    deleteInDirectory(file);
                }
                file.delete();
            }
        }
    }

//    public List<WritableRepositoryContents> updateForProject(WLProject project) throws FailedConnectionException,
//                                                                                       InvalidProjectException {
//        SortedSet<Snapshot> snapshots = project.fetchNewSnapshots();
//        String projectName = project.getName();
//        WLDirectoryNode directoryNode = getDirectoryNodeForProjectName(projectName);
//        List<WritableRepositoryContents> writableRepositories = new LinkedList<WritableRepositoryContents>();
//        for (Snapshot snapshot : snapshots) {
//            writableRepositories.add(new GitDirectoryContents(directoryNode.updateFromSnapshot(snapshot),
//                                                              rootGitDirectory,
//                                                              projectName,
//                                                              snapshot));
//        }
//        directoryNode.updatePersistentStore(persistentStore, null);
//        return writableRepositories;
//    }

//    public WLDirectoryNode createNextDirectoryNodeInProjectFromContents(WLProject project, RawDirectoryContents directoryContents) throws IOException, FailedConnectionException {
//        return getDirectoryNodeForProjectName(project.getName()).createFromRawDirectoryContents(directoryContents, attDirectory);
//    }

    public void approveCandidateSnapshot(bullshit candidateSnapshot) {
        WLDirectoryNode directoryNode = candidateSnapshot.getDirectoryNode();
        fileStore.put(candidateSnapshot.getProjectName(), directoryNode);
//        directoryNode.updatePersistentStore(persistentStore, null);
    }

    private WLDirectoryNode getDirectoryNodeForProjectName(String projectName) {
        WLDirectoryNode directoryNode = fileStore.get(projectName);
        if (directoryNode == null) {
//            directoryNode = new WLDirectoryNode(projectName, attDirectory, rootGitDirectory, persistentStore);
            fileStore.put(projectName, directoryNode);
        }
        return directoryNode;
    }

}
