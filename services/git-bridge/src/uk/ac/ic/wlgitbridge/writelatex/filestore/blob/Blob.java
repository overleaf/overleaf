package uk.ac.ic.wlgitbridge.writelatex.filestore.blob;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.AttachmentNode;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreUpdater;

import java.util.Arrays;

/**
 * Created by Winston on 14/11/14.
 */
public abstract class Blob implements PersistentStoreUpdater<AttachmentNode> {

    public abstract byte[] getContents() throws FailedConnectionException;

    @Override
    public boolean equals(Object obj) {
        if (!(obj instanceof Blob)) {
            return false;
        }
        Blob that = (Blob) obj;
        try {
            return Arrays.equals(getContents(), that.getContents());
        } catch (FailedConnectionException e) {
            throw new RuntimeException(e);
        }
    }

}
