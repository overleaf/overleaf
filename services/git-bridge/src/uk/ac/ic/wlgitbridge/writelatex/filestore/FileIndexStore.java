package uk.ac.ic.wlgitbridge.writelatex.filestore;

import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 08/11/14.
 */
public class FileIndexStore {

    private final Map<BlobHash, String> blobHashMappings;
    private final Map<String, String> urlMappings;

    public FileIndexStore() {
        blobHashMappings = new HashMap<BlobHash, String>();
        urlMappings = new HashMap<String, String>();
    }



}
