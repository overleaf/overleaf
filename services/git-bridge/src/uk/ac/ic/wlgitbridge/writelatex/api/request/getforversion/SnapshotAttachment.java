package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.ning.http.client.AsyncCompletionHandler;
import com.ning.http.client.AsyncHttpClient;
import com.ning.http.client.HttpResponseBodyPart;
import com.ning.http.client.Response;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotAttachment extends SnapshotFile {

    private Future<byte[]> future;

    public SnapshotAttachment(JsonElement json) throws FailedConnectionException {
        super(json);
    }

    @Override
    public byte[] getContents() throws FailedConnectionException {
        try {
            return future.get();
        } catch (InterruptedException e) {
            throw new FailedConnectionException();
        } catch (ExecutionException e) {
            throw new FailedConnectionException();
        }
    }

    @Override
    protected void getContentsFromJSON(JsonArray jsonArray) throws FailedConnectionException {
        fetchContents(jsonArray.get(0).getAsString());
    }

    private void fetchContents(String url) throws FailedConnectionException {
        AsyncHttpClient asyncHttpClient = new AsyncHttpClient();
        try {
            future = asyncHttpClient.prepareGet(url).execute(new AsyncCompletionHandler<byte[]>() {

                ByteArrayOutputStream bytes = new ByteArrayOutputStream();

                @Override
                public STATE onBodyPartReceived(HttpResponseBodyPart bodyPart) throws Exception {
                    bytes.write(bodyPart.getBodyPartBytes());
                    return STATE.CONTINUE;
                }

                @Override
                public byte[] onCompleted(Response response) throws Exception {
                    return bytes.toByteArray();
                }

            });
        } catch (IOException e) {
            throw new FailedConnectionException();
        }
    }

}
