package uk.ac.ic.wlgitbridge.writelatex.filestore.blob;

import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;

/**
 * Created by Winston on 14/11/14.
 */
public class SnapshotFileBlob extends ByteBlob {

    public SnapshotFileBlob(SnapshotFile snapshotFile) {
        super(snapshotFile.getContents());
    }

}
