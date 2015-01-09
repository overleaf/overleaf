package uk.ac.ic.wlgitbridge.writelatex.filestore;

import uk.ac.ic.wlgitbridge.bridge.RawFile;

import java.util.Map.Entry;

/**
 * Created by Winston on 16/11/14.
 */
public class RepositoryFile implements RawFile {

    private final Entry<String, byte[]> fileContents;

    public RepositoryFile(Entry<String, byte[]> fileContents) {
        this.fileContents = fileContents;
    }

    @Override
    public String getPath() {
        return fileContents.getKey();
    }

    @Override
    public byte[] getContents() {
        return fileContents.getValue();
    }

}
