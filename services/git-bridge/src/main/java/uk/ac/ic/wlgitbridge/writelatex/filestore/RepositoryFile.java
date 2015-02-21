package uk.ac.ic.wlgitbridge.writelatex.filestore;

import uk.ac.ic.wlgitbridge.bridge.RawFile;

import java.util.Map.Entry;

/**
 * Created by Winston on 16/11/14.
 */
public class RepositoryFile extends RawFile {

    private final String path;
    private final byte[] contents;

    public RepositoryFile(Entry<String, byte[]> fileContents) {
        path = fileContents.getKey();
        contents = fileContents.getValue();
    }

    public RepositoryFile(String path, byte[] contents) {
        this.path = path;
        this.contents = contents;
    }

    @Override
    public String getPath() {
        return path;
    }

    @Override
    public byte[] getContents() {
        return contents;
    }

}
