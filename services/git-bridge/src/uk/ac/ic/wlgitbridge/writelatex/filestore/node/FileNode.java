package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.Blob;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public abstract class FileNode {

    private final String filePath;
    private final boolean unchanged;

    public FileNode(SnapshotFile snapshotFile, Map<String, FileNode> context) throws FailedConnectionException {
        filePath = snapshotFile.getPath();
        FileNode currentFileNode = context.get(filePath);
        unchanged = currentFileNode != null && equals(currentFileNode);
    }

    public String getFilePath() {
        return filePath;
    }

    public byte[] getContents() throws FailedConnectionException {
        return getBlob().getContents();
    }

    public void writeToDisk(String repoDir) throws FailedConnectionException, IOException {
        File file = new File(repoDir, filePath);
        file.getParentFile().mkdirs();
        file.createNewFile();
        OutputStream out = new FileOutputStream(file);
        out.write(getContents());
        out.close();
    }

    public abstract void handleIndexer(FileNodeIndexer fileNodeIndexer);

    protected abstract Blob getBlob();

}
