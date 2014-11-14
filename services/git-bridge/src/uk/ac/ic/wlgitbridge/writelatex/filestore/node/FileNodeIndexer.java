package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

/**
 * Created by Winston on 14/11/14.
 */
public interface FileNodeIndexer {

    public void index(BlobNode blobNode);
    public void index(AttachmentNode attachmentNode);

}
