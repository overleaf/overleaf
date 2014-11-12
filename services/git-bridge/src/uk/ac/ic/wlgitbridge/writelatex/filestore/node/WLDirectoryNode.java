package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.FileIndexStore;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProject;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 08/11/14.
 */
public class WLDirectoryNode {

    private Map<String, FileNode> files;
    private final FileIndexStore fileIndexes;
    private final String rootGitDirectoryPath;

    public WLDirectoryNode(String rootGitDirectoryPath, String projectName) {
        this.rootGitDirectoryPath = rootGitDirectoryPath;
        files = new HashMap<String, FileNode>();
        fileIndexes = new FileIndexStore();
    }

    public void updateFromSnapshot(Snapshot snapshot) {
        Map<String, FileNode> updatedFiles = new HashMap<String, FileNode>();
        List<SnapshotFile> srcs = snapshot.getSrcs();
        List<SnapshotAttachment> atts = snapshot.getAtts();
        for (SnapshotFile src : srcs) {
            BlobNode blobNode = new BlobNode(src, files);
            updatedFiles.put(blobNode.getFilePath(), blobNode);
        }
        for (SnapshotAttachment att : atts) {
            AttachmentNode attachmentNode = new AttachmentNode(att, files);
            updatedFiles.put(attachmentNode.getFilePath(), attachmentNode);
        }
        files = updatedFiles;
        try {
            throw new Throwable();
        } catch (Throwable t) {
            t.printStackTrace();
        }
        System.out.println(this);
    }

    @Override
    public String toString() {
        return files.toString();
    }

}
