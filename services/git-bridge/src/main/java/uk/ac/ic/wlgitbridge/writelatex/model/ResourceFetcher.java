package uk.ac.ic.wlgitbridge.writelatex.model;

import com.ning.http.client.AsyncCompletionHandler;
import com.ning.http.client.AsyncHttpClient;
import com.ning.http.client.HttpResponseBodyPart;
import com.ning.http.client.Response;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.bridge.RawFile;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;
import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.RepositoryFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 21/02/15.
 */
public class ResourceFetcher {

    private final URLIndexStore urlIndexStore;

    public ResourceFetcher(URLIndexStore urlIndexStore) {
        this.urlIndexStore = urlIndexStore;
    }

    public RawFile get(String projectName, String url, String newPath, Repository repository) throws IOException {
        String path = urlIndexStore.getPathForURLInProject(projectName, url);
        byte[] contents;
        if (path == null) {
            path = newPath;
            contents = fetch(projectName, url, path);
        } else {
            Util.sout("Found (" + projectName + "): " + url);
            Util.sout("At (" + projectName + "): " + path);
            contents = new RepositoryObjectTreeWalker(repository).getDirectoryContents().getFileTable().get(path).getContents();
        }
        return new RepositoryFile(path, contents);
    }

    private byte[] fetch(String projectName, final String url, String path) throws FailedConnectionException {
        byte[] contents;
        Util.sout("GET -> " + url);
        try {
            contents = new AsyncHttpClient().prepareGet(url).execute(new AsyncCompletionHandler<byte[]>() {

                ByteArrayOutputStream bytes = new ByteArrayOutputStream();

                @Override
                public STATE onBodyPartReceived(HttpResponseBodyPart bodyPart) throws Exception {
                    bytes.write(bodyPart.getBodyPartBytes());
                    return STATE.CONTINUE;
                }

                @Override
                public byte[] onCompleted(Response response) throws Exception {
                    byte[] data = bytes.toByteArray();
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
        urlIndexStore.addURLIndexForProject(projectName, url, path);
        return contents;
    }

}
