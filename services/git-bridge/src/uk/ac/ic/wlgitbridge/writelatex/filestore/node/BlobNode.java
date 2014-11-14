package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.Blob;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.SnapshotFileBlob;

import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public class BlobNode extends FileNode {

    private SnapshotFileBlob blob;

    public BlobNode(SnapshotFile snapshotFile, Map<String, FileNode> context) throws FailedConnectionException {
        super(snapshotFile, context);
        blob = new SnapshotFileBlob(snapshotFile);
    }

    @Override
    public void handleIndexer(FileNodeIndexer fileNodeIndexer) {
        fileNodeIndexer.index(this);
    }

    @Override
    protected Blob getBlob() {
        return blob;
    }

}
