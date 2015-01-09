package uk.ac.ic.wlgitbridge.writelatex.filestore.blob;

import uk.ac.ic.wlgitbridge.bridge.RawFile;

/**
 * Created by Winston on 14/11/14.
 */
public class RawFileBlob extends ByteBlob {

    public RawFileBlob(RawFile rawFile) {
        super(rawFile.getContents());
    }

}
