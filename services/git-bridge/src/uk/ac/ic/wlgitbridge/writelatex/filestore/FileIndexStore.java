package uk.ac.ic.wlgitbridge.writelatex.filestore;

import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;

import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 08/11/14.
 */
public class FileIndexStore {

    private final Map<BlobHash, FileNode> blobHashMappings;
    private final Map<String, FileNode> urlMappings;

    public FileIndexStore() {
        blobHashMappings = new HashMap<BlobHash, FileNode>();
        urlMappings = new HashMap<String, FileNode>();
    }

    public void addAttachment(String url, FileNode fileNode) {
        urlMappings.put(url, fileNode);
    }

}
