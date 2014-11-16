package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.bridge.RawFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.Blob;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.ByteBlob;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.RawFileBlob;

import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public class BlobNode extends FileNode {

    private ByteBlob blob;

    public BlobNode(RawFile rawFile, Map<String, FileNode> context) {
        super(rawFile, context);
        blob = new RawFileBlob(rawFile);
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
