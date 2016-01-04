package uk.ac.ic.wlgitbridge.data.model;

import com.ning.http.client.AsyncCompletionHandler;
import com.ning.http.client.HttpResponseBodyPart;
import com.ning.http.client.Response;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.data.model.db.PersistentStore;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;
import uk.ac.ic.wlgitbridge.snapshot.base.Request;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 21/02/15.
 */
public class ResourceFetcher {

    private final PersistentStore persistentStore;

    public ResourceFetcher(PersistentStore persistentStore) {
        this.persistentStore = persistentStore;
    }

    public RawFile get(String projectName, String url, String newPath, Repository repository, Map<String, byte[]> fetchedUrls) throws IOException {
        String path = persistentStore.getPathForURLInProject(projectName, url);
        byte[] contents;
        if (path == null) {
            path = newPath;
            contents = fetch(projectName, url, path);
            fetchedUrls.put(url, contents);
        } else {
            Util.sout("Found (" + projectName + "): " + url);
            Util.sout("At (" + projectName + "): " + path);
            contents = fetchedUrls.get(url);
            if (contents == null) {
                RawFile rawFile = new RepositoryObjectTreeWalker(repository).getDirectoryContents().getFileTable().get(path);
                if (rawFile == null) {
                    Util.sout(
                        "WARNING: " +
                        "File " + path + " was not in the current commit, or the git tree, yet path was not null. " +
                        "File url is: " + url
                    );
                    contents = fetch(projectName, url, path);
                } else {
                    contents = rawFile.getContents();
                }
            }
        }
        return new RepositoryFile(newPath, contents);
    }

    private byte[] fetch(String projectName, final String url, String path) throws FailedConnectionException {
        byte[] contents;
        Util.sout("GET -> " + url);
        try {
            contents = Request.httpClient.prepareGet(url).execute(new AsyncCompletionHandler<byte[]>() {

                ByteArrayOutputStream bytes = new ByteArrayOutputStream();

                @Override
                public STATE onBodyPartReceived(HttpResponseBodyPart bodyPart) throws Exception {
                    bytes.write(bodyPart.getBodyPartBytes());
                    return STATE.CONTINUE;
                }

                @Override
                public byte[] onCompleted(Response response) throws Exception {
                    byte[] data = bytes.toByteArray();
                    bytes.close();
                    Util.sout(response.getStatusCode() + " " + response.getStatusText() + " (" + data.length + "B) -> " + url);
                    return data;
                }

            }).get();
        } catch (InterruptedException e) {
            Util.printStackTrace(e);
            throw new FailedConnectionException();
        } catch (ExecutionException e) {
            Util.printStackTrace(e);
            throw new FailedConnectionException();
        }
        persistentStore.addURLIndexForProject(projectName, url, path);
        return contents;
    }
}
