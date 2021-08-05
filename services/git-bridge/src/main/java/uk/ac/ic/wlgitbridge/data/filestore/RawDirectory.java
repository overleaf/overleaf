package uk.ac.ic.wlgitbridge.data.filestore;

import uk.ac.ic.wlgitbridge.git.exception.SizeLimitExceededException;

import java.util.Map;
import java.util.Optional;

/**
 * Created by Winston on 16/11/14.
 */
public class RawDirectory {

    private final Map<String, RawFile> fileTable;

    public RawDirectory(Map<String, RawFile> fileTable) {
        this.fileTable = fileTable;
    }

    public Map<String, RawFile> getFileTable() {
        return fileTable;
    }

}
