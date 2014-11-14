package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.AttachmentBlob;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.FileIndexStore;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.Blob;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.ExternalBlob;

import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public class AttachmentNode extends FileNode {

    private final String url;
    private Blob blob;

    public AttachmentNode(SnapshotAttachment snapshotAttachment, Map<String, FileNode> context, FileIndexStore fileIndexes) throws FailedConnectionException {
        super(snapshotAttachment, context);
        url = snapshotAttachment.getUrl();
        initBlob(fileIndexes);
    }

    @Override
    public void handleIndexer(FileNodeIndexer fileNodeIndexer) {
        fileNodeIndexer.index(this);
    }

    @Override
    protected Blob getBlob() {
        return blob;
    }

    public String getURL() {
        return url;
    }

    private void initBlob(FileIndexStore fileIndexes) throws FailedConnectionException {
        if (fileIndexes.hasAttachmentWithURL(url)) {
            FileNode attachment = fileIndexes.getAttachment(url);
            blob = new AttachmentBlob(attachment);
        } else {
            blob = new ExternalBlob(url);
        }
    }

}
