package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.FileIndexStore;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 08/11/14.
 */
public class WLDirectoryNode {

    private Map<String, FileNode> fileNodeTable;
    private FileIndexStore fileIndexStore;

    public WLDirectoryNode() {
        fileNodeTable = new HashMap<String, FileNode>();
        fileIndexStore = new FileIndexStore();
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
        fileNodeTable = updatedFileNodeTable;
        LinkedList<FileNode> fileNodes = new LinkedList<FileNode>(updatedFileNodeTable.values());
        fileIndexStore = new FileIndexStore(fileNodes);
        return fileNodes;
    }

    @Override
    public String toString() {
        return fileNodeTable.toString();
    }

}
