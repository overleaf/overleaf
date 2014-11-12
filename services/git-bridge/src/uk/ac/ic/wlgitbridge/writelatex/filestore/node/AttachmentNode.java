package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotAttachment;

import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public class AttachmentNode extends FileNode {

    public AttachmentNode(SnapshotAttachment snapshotAttachment, Map<String, FileNode> context) {
        super(snapshotAttachment, context);
    }

}
