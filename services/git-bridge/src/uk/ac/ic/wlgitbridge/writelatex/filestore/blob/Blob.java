package uk.ac.ic.wlgitbridge.writelatex.filestore.blob;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

/**
 * Created by Winston on 14/11/14.
 */
public abstract class Blob {

    public abstract byte[] getContents() throws FailedConnectionException;

}
