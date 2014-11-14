package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.FileIndexStore;

import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public abstract class FileNode {

    private final String filePath;
    private final boolean unchanged;
    private byte[] contents;

    public FileNode(SnapshotFile snapshotFile, Map<String, FileNode> context) throws FailedConnectionException {
        filePath = snapshotFile.getPath();
        FileNode currentFileNode = context.get(filePath);
        unchanged = currentFileNode != null && equals(currentFileNode);
        contents = initContents();
    }

    public String getFilePath() {
        return filePath;
    }

    public abstract byte[] initContents() throws FailedConnectionException;

}
