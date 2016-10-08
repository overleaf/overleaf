package uk.ac.ic.wlgitbridge.data.filestore;

import uk.ac.ic.wlgitbridge.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;

/**
 * Created by Winston on 16/11/14.
 */
public abstract class RawFile {

    public abstract String getPath();
    public abstract byte[] getContents();

    public final void writeToDisk(File directory) throws IOException {
        File file = new File(directory, getPath());
        file.getParentFile().mkdirs();
        file.createNewFile();
        OutputStream out = new FileOutputStream(file);
        out.write(getContents());
        out.close();
        Log.info("Wrote file: {}", file.getAbsolutePath());
    }

    @Override
    public boolean equals(Object obj) {
        if (!(obj instanceof RawFile)) {
            return false;
        }
        RawFile that = (RawFile) obj;
        return getPath().equals(that.getPath())
                && Arrays.equals(getContents(), that.getContents());
    }

}
