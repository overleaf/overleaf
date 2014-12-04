package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.bridge.RawFile;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.Blob;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreUpdater;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public abstract class FileNode implements PersistentStoreUpdater<String> {

    private final String filePath;
    private FileNode previous;
    private boolean changed;

    public FileNode(RawFile file, Map<String, FileNode> context) {
        this(file.getPath(), context);
    }

    public FileNode(String filePath, Map<String, FileNode> context) {
        previous = context.get(filePath);
        this.filePath = filePath;
    }

    protected FileNode(String filePath, boolean changed) {
        this.filePath = filePath;
        this.changed = changed;
    }

    protected FileNode() {
        filePath = "";
        previous = null;
        changed = false;
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

    public String getFilePath() {
        return filePath;
    }

    public boolean isChanged() {
        return changed || previous == null || !equals(previous);
    }

    public abstract void indexWith(FileNodeIndexer indexer);
    protected abstract Blob getBlob();

    @Override
    public boolean equals(Object obj) {
        return obj instanceof FileNode && filePath.equals(((FileNode) obj).filePath);
    }

    @Override
    public String toString() {
        return filePath;
    }

}
