package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.FileIndexStore;

import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public class BlobNode extends FileNode {

    private SnapshotFile snapshotFile;

    public BlobNode(SnapshotFile snapshotFile, Map<String, FileNode> context) throws FailedConnectionException {
        super(snapshotFile, context);
        this.snapshotFile = snapshotFile;
    }

    @Override
    public byte[] initContents() throws FailedConnectionException {
        return snapshotFile.getContents();
    }

}
