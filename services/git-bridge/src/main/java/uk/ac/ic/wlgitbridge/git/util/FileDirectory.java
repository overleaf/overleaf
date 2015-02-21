package uk.ac.ic.wlgitbridge.git.util;

import uk.ac.ic.wlgitbridge.bridge.RawDirectory;
import uk.ac.ic.wlgitbridge.bridge.RawFile;

import java.util.Map;

/**
 * Created by Winston on 16/11/14.
 */
public class FileDirectory implements RawDirectory {

    private final Map<String, RawFile> fileTable;

    public FileDirectory(Map<String, RawFile> fileTable) {
        this.fileTable = fileTable;
    }

    @Override
    public Map<String, RawFile> getFileTable() {
        return fileTable;
    }

}
