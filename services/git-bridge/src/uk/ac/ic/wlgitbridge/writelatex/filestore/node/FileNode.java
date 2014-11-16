package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.bridge.RawFile;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
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
    private final boolean changed;

    public FileNode(RawFile file, Map<String, FileNode> context) {
        this(file.getPath(), context);
    }

    public FileNode(String filePath, Map<String, FileNode> context) {
        this.filePath = filePath;
        FileNode currentFileNode = context.get(filePath);
        changed = currentFileNode == null || !equals(currentFileNode);
    }

    public String getFilePath() {
        return filePath;
    }

    public boolean isChanged() {
        return changed;
    }

    public byte[] getContents() throws FailedConnectionException {
        return getBlob().getContents();
    }

    public void writeToDisk(File directory) throws FailedConnectionException, IOException {
        File file = new File(directory, filePath);
        file.getParentFile().mkdirs();
        file.createNewFile();
        OutputStream out = new FileOutputStream(file);
        out.write(getContents());
        out.close();
    }

    public abstract void handleIndexer(FileNodeIndexer fileNodeIndexer);

    protected abstract Blob getBlob();

    @Override
    public boolean equals(Object obj) {
        return obj instanceof FileNode && filePath.equals(((FileNode) obj).filePath);
    }

    @Override
    public String toString() {
        return String.valueOf(changed);
    }

}
