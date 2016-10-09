package uk.ac.ic.wlgitbridge.bridge.resource;

import com.ning.http.client.AsyncCompletionHandler;
import com.ning.http.client.HttpResponseBodyPart;
import com.ning.http.client.Response;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.snapshot.base.Request;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ExecutionException;

/**
 * Created by winston on 20/08/2016.
 */
public class UrlResourceCache implements ResourceCache {

    private final DBStore dbStore;

    public UrlResourceCache(DBStore dbStore) {
        this.dbStore = dbStore;
    }

    @Override
    public RawFile get(
            String projectName,
            String url,
            String newPath,
            Map<String, RawFile> fileTable,
            Map<String, byte[]> fetchedUrls
    ) throws IOException {
        String path = dbStore.getPathForURLInProject(projectName, url);
        byte[] contents;
        if (path == null) {
            path = newPath;
            contents = fetch(projectName, url, path);
            fetchedUrls.put(url, contents);
        } else {
            Log.info("Found (" + projectName + "): " + url);
            Log.info("At (" + projectName + "): " + path);
            contents = fetchedUrls.get(url);
            if (contents == null) {
                RawFile rawFile = fileTable.get(path);
                if (rawFile == null) {
                    Log.warn(
                            "File " + path
                                    + " was not in the current commit, "
                                    + "or the git tree, yet path was not null. "
                                    + "File url is: "
                                    + url
                    );
                    contents = fetch(projectName, url, path);
                } else {
                    contents = rawFile.getContents();
                }
            }
        }
        return new RepositoryFile(newPath, contents);
    }

    private byte[] fetch(
            String projectName,
            final String url,
            String path
    ) throws FailedConnectionException {
        byte[] contents;
        Log.info("GET -> " + url);
        try {
            contents = Request.httpClient.prepareGet(url).execute(
                    new AsyncCompletionHandler<byte[]>() {

                ByteArrayOutputStream bytes = new ByteArrayOutputStream();

                @Override
                public STATE onBodyPartReceived(
                        HttpResponseBodyPart bodyPart
                ) throws Exception {
                    bytes.write(bodyPart.getBodyPartBytes());
                    return STATE.CONTINUE;
                }

                @Override
                public byte[] onCompleted(
                        Response response
                ) throws Exception {
                    byte[] data = bytes.toByteArray();
                    bytes.close();
                    Log.info(
                            response.getStatusCode()
                                    + " "
                                    + response.getStatusText()
                                    + " ("
                                    + data.length
                                    + "B) -> "
                                    + url
                    );
                    return data;
                }

            }).get();
        } catch (InterruptedException e) {
            Log.warn(
                    "Interrupted when fetching project: "  +
                            projectName  +
                            ", url: " +
                            url +
                            ", path: " +
                            path,
                    e
            );
            throw new FailedConnectionException();
        } catch (ExecutionException e) {
            Log.warn(
                    "ExecutionException when fetching project: " +
                            projectName +
                            ", url: " +
                            url +
                            ", path: " +
                            path,
                    e
            );
            throw new FailedConnectionException();
        }
        dbStore.addURLIndexForProject(projectName, url, path);
        return contents;
    }

}
