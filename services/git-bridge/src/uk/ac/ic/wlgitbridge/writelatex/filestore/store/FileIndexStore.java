package uk.ac.ic.wlgitbridge.writelatex.filestore.store;

import uk.ac.ic.wlgitbridge.writelatex.filestore.node.AttachmentNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.BlobNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNodeIndexer;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 08/11/14.
 */
public class FileIndexStore implements FileNodeIndexer {

    private final Map<BlobHash, FileNode> blobHashMappings;
    private final Map<String, FileNode> urlMappings;

    public FileIndexStore(List<FileNode> fileNodes) {
        blobHashMappings = new HashMap<BlobHash, FileNode>();
        urlMappings = new HashMap<String, FileNode>();
        for (FileNode fileNode : fileNodes) {
            fileNode.indexWith(this);
        }
    }

    public FileIndexStore() {
        this(new LinkedList<FileNode>());
    }

    @Override
    public void index(BlobNode blobNode) {

    }

    @Override
    public void index(AttachmentNode attachmentNode) {
        urlMappings.put(attachmentNode.getURL(), attachmentNode);
    }

    public boolean hasAttachmentWithURL(String url) {
        return urlMappings.containsKey(url);
    }

    public FileNode getAttachment(String url) {
        return urlMappings.get(url);
    }

}

/*Winston is really cool
        and he's a cat
meow
miaow
meaaaoowww
=^.^=
*/