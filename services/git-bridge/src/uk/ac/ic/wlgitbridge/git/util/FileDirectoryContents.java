package uk.ac.ic.wlgitbridge.git.util;

import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;

import java.util.Map;

/**
 * Created by Winston on 16/11/14.
 */
public class FileDirectoryContents implements RawDirectoryContents {

    private final Map<String, byte[]> fileContentsTable;

    public FileDirectoryContents(Map<String, byte[]> fileContentsTable) {
        this.fileContentsTable = fileContentsTable;
    }

    @Override
    public Map<String, byte[]> getFileContentsTable() {
        return fileContentsTable;
    }

}
