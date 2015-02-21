package uk.ac.ic.wlgitbridge.bridge;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

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
    }

}
