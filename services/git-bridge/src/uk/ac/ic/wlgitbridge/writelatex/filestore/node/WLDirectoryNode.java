package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.FileIndexStore;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreAPI;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreSource;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreUpdater;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

/**
 * Created by Winston on 08/11/14.
 */
public class WLDirectoryNode implements PersistentStoreSource, PersistentStoreUpdater<Void> {

    private final String projectName;
    private Map<String, FileNode> fileNodeTable;
    private FileIndexStore fileIndexStore;

    public WLDirectoryNode(String projectName, PersistentStoreAPI persistentStore) {
        this(projectName);
        initFromPersistentStore(persistentStore);
    }

    private WLDirectoryNode(String projectName) {
        this.projectName = projectName;
    }

    private WLDirectoryNode(String projectName, Map<String, FileNode> fileNodeTable, FileIndexStore fileIndexStore) {
        this.projectName = projectName;
        this.fileNodeTable = fileNodeTable;
        this.fileIndexStore = fileIndexStore;
    }

    @Override
    public void initFromPersistentStore(PersistentStoreAPI persistentStore) {
        fileIndexStore = new FileIndexStore(projectName, persistentStore);
        fileNodeTable = new HashMap<String, FileNode>();
        for (FileNode fileNode : persistentStore.getFileNodesForProjectName(projectName, fileIndexStore)) {
            fileNodeTable.put(fileNode.getFilePath(), fileNode);
        }
    }

    @Override
    public void updatePersistentStore(PersistentStoreAPI persistentStore, Void info) {
        updateFileNodeTableInPersistentStore(persistentStore);
        fileIndexStore.updatePersistentStore(persistentStore, projectName);
    }

    private void updateFileNodeTableInPersistentStore(PersistentStoreAPI persistentStore) {
        persistentStore.deleteFileNodesForProjectName(projectName);
        for (FileNode fileNode : fileNodeTable.values()) {
            fileNode.updatePersistentStore(persistentStore, projectName);
        }
    }

    public List<FileNode> getFileNodes() {
        return new LinkedList<FileNode>(fileNodeTable.values());
    }

    public List<FileNode> updateFromSnapshot(Snapshot snapshot) throws FailedConnectionException {
        Map<String, FileNode> updatedFileNodeTable = new HashMap<String, FileNode>();
        List<SnapshotFile> srcs = snapshot.getSrcs();
        List<SnapshotAttachment> atts = snapshot.getAtts();
        for (SnapshotFile src : srcs) {
            BlobNode blobNode = new BlobNode(src, fileNodeTable);
            updatedFileNodeTable.put(blobNode.getFilePath(), blobNode);
        }
        for (SnapshotAttachment att : atts) {
            AttachmentNode attachmentNode = new AttachmentNode(att, fileNodeTable, fileIndexStore);
            updatedFileNodeTable.put(attachmentNode.getFilePath(), attachmentNode);
        }
        LinkedList<FileNode> fileNodes = new LinkedList<FileNode>(updatedFileNodeTable.values());
        fileNodeTable = updatedFileNodeTable;
        fileIndexStore = new FileIndexStore(fileNodes);
        return fileNodes;
    }

    public WLDirectoryNode createFromRawDirectoryContents(RawDirectoryContents rawDirectoryContents, File attachmentDirectory) throws IOException, FailedConnectionException {
        Map<String, FileNode> candidateFileNodeTable = new HashMap<String, FileNode>();
        File projectAttDirectory = new File(attachmentDirectory, projectName);
        projectAttDirectory.mkdirs();
        WLFileStore.deleteInDirectory(projectAttDirectory);
        for (Entry<String, byte[]> fileContents : rawDirectoryContents.getFileContentsTable().entrySet()) {
            BlobNode blobNode = new BlobNode(new RepositoryFile(fileContents), fileNodeTable, projectAttDirectory);
            candidateFileNodeTable.put(blobNode.getFilePath(), blobNode);
        }
        return new WLDirectoryNode(projectName, candidateFileNodeTable,
                                   new FileIndexStore(new LinkedList<FileNode>(candidateFileNodeTable.values())));
    }

    @Override
    public String toString() {
        return fileNodeTable.toString();
    }

}
