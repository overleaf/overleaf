package uk.ac.ic.wlgitbridge.writelatex.filestore.blob;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;

/**
 * Created by Winston on 14/11/14.
 */
public class AttachmentBlob extends ByteBlob {

    public AttachmentBlob(FileNode fileNode) throws FailedConnectionException {
        super(fileNode.getContents());
    }

}
