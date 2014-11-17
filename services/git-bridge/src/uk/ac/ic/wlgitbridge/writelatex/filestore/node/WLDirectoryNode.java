package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.FileIndexStore;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;

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
public class WLDirectoryNode {

    private final String projectName;
    private Map<String, FileNode> fileNodeTable;
    private FileIndexStore fileIndexStore;

    public WLDirectoryNode(String projectName) {
        this(projectName, new HashMap<String, FileNode>(), new FileIndexStore());
    }

    public WLDirectoryNode(String projectName, Map<String, FileNode> fileNodeTable, FileIndexStore fileIndexStore) {
        this.projectName = projectName;
        this.fileNodeTable = fileNodeTable;
        this.fileIndexStore = fileIndexStore;
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
