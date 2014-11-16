package uk.ac.ic.wlgitbridge.bridge;

import java.util.Map;

/**
 * Created by Winston on 16/11/14.
 */
public interface RawDirectoryContents {

    public Map<String, byte[]> getFileContentsTable();
}
