package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;

import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public class BlobNode extends FileNode {

    public BlobNode(SnapshotFile snapshotFile, Map<String, FileNode> context) {
        super(snapshotFile, context);
    }

}
