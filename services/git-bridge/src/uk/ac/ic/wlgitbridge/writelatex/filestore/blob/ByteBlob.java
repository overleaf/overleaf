package uk.ac.ic.wlgitbridge.writelatex.filestore.blob;

/**
 * Created by Winston on 14/11/14.
 */
public abstract class ByteBlob extends Blob {

    private final byte[] contents;

    public ByteBlob(byte[] contents) {
        this.contents = contents;
    }

    @Override
    public byte[] getContents() {
        return contents;
    }

}
