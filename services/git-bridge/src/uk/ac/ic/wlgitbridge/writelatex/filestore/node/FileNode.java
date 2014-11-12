package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;

import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public abstract class FileNode {

    private final String filePath;
    private final boolean unchanged;

    public FileNode(SnapshotFile snapshotFile, Map<String, FileNode> context) {
        filePath = snapshotFile.getPath();
        FileNode currentFileNode = context.get(filePath);
        unchanged = currentFileNode != null && equals(currentFileNode);
    }

    public String getFilePath() {
        return filePath;
    }

}
