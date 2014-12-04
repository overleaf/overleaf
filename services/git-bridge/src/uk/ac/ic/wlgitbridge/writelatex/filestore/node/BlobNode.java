package uk.ac.ic.wlgitbridge.writelatex.filestore.node;

import uk.ac.ic.wlgitbridge.bridge.RawFile;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.Blob;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.ByteBlob;
import uk.ac.ic.wlgitbridge.writelatex.filestore.blob.RawFileBlob;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreAPI;

import java.io.File;
import java.io.IOException;
import java.util.Map;

/**
 * Created by Winston on 12/11/14.
 */
public class BlobNode extends FileNode {

    private ByteBlob blob;

    public BlobNode(RawFile rawFile, Map<String, FileNode> context) {
        super(rawFile, context);
        blob = new RawFileBlob(rawFile);
    }

    public BlobNode(RepositoryFile repositoryFile, Map<String, FileNode> fileNodeTable, File projectAttDirectory) throws IOException, FailedConnectionException {
        this(repositoryFile, fileNodeTable);
        blob = new RawFileBlob(repositoryFile);
        writeChanged(projectAttDirectory);
    }

    public BlobNode(String fileName, boolean changed, byte[] blob) {
        super(fileName, changed);
        this.blob = new ByteBlob(blob);
    }

    @Override
    public void indexWith(FileNodeIndexer fileNodeIndexer) {
        fileNodeIndexer.index(this);
    }

    @Override
    protected Blob getBlob() {
        return blob;
    }

    @Override
    public void updatePersistentStore(PersistentStoreAPI persistentStore, String projectName) {
        try {
            persistentStore.addFileNodeBlob(projectName, getFilePath(), isChanged(), getBlob().getContents());
        } catch (FailedConnectionException e) {
            throw new RuntimeException(e);
        }
    }

    private void writeChanged(File projectAttDirectory) throws FailedConnectionException, IOException {
        if (isChanged()) {
            writeToDisk(projectAttDirectory);
        }
    }
}
