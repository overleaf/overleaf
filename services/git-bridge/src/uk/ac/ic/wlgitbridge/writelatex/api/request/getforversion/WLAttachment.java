package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.ning.http.client.*;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;

/**
 * Created by Winston on 06/11/14.
 */
public class WLAttachment extends WLFile {

    private Future<byte[]> future;

    public WLAttachment(JsonElement json) {
        super(json);
    }

    @Override
    public byte[] getContents() throws ExecutionException, InterruptedException {
        return future.get();
    }

    @Override
    protected void getContentsFromJSON(JsonArray jsonArray) {
        try {
            fetchContents(jsonArray.get(0).getAsString());
        } catch (IOException e) {
            throw new RuntimeException();
        }
    }

    private void fetchContents(String url) throws IOException {
        AsyncHttpClient asyncHttpClient = new AsyncHttpClient();
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
    }

}
