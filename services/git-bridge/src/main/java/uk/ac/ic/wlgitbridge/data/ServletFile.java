package uk.ac.ic.wlgitbridge.data;

import uk.ac.ic.wlgitbridge.data.filestore.RawFile;

/**
 * Created by Winston on 21/02/15.
 */
public class ServletFile extends RawFile {

    private final RawFile file;
    private final boolean changed;

    public ServletFile(RawFile file, RawFile oldFile) {
        this.file = file;
        changed = !equals(oldFile);
    }

    @Override
    public String getPath() {
        return file.getPath();
    }

    @Override
    public byte[] getContents() {
        return file.getContents();
    }

    public boolean isChanged() {
        return changed;
    }

}
