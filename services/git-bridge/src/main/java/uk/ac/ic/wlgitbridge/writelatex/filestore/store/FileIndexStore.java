package uk.ac.ic.wlgitbridge.writelatex.filestore.store;

import uk.ac.ic.wlgitbridge.writelatex.filestore.node.AttachmentNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.BlobNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNodeIndexer;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreAPI;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreSource;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreUpdater;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

/**
 * Created by Winston on 08/11/14.
 */
public class FileIndexStore implements FileNodeIndexer, PersistentStoreSource, PersistentStoreUpdater<String> {

    private final Map<BlobHash, FileNode> blobHashMappings;
    private Map<String, FileNode> urlMappings;

    private String projectName;

    public FileIndexStore(List<FileNode> fileNodes) {
        blobHashMappings = new HashMap<BlobHash, FileNode>();
        urlMappings = new HashMap<String, FileNode>();
        for (FileNode fileNode : fileNodes) {
            fileNode.indexWith(this);
        }
    }

    public FileIndexStore(String projectName, PersistentStoreAPI persistentStore) {
        this.projectName = projectName;
        blobHashMappings = new HashMap<BlobHash, FileNode>();
        initFromPersistentStore(persistentStore);
    }

    @Override
    public void index(BlobNode blobNode) {

    }

    @Override
    public void index(AttachmentNode attachmentNode) {
        urlMappings.put(attachmentNode.getURL(), attachmentNode);
    }

    @Override
    public void initFromPersistentStore(PersistentStoreAPI persistentStore) {
//        urlMappings = persistentStore.getURLIndexTableForProjectName(projectName);
    }

    public boolean hasAttachmentWithURL(String url) {
        return urlMappings.containsKey(url);
    }

    public FileNode getAttachment(String url) {
        return urlMappings.get(url);
    }

    @Override
    public void updatePersistentStore(PersistentStoreAPI persistentStore, String projectName) {
//        persistentStore.deleteURLIndexesForProjectName(projectName);
        for (Entry<String, FileNode> urlMapping : urlMappings.entrySet()) {
//            try {
//                persistentStore.addURLIndex(projectName, urlMapping.getKey(), urlMapping.getValue().getContents());
//            } catch (FailedConnectionException e) {
//                throw new RuntimeException(e);
//            }
        }
    }

}

/*Winston is really cool
        and he's a cat
meow
miaow
meaaaoowww
=^.^=
*/