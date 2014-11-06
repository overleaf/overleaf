package uk.ac.ic.wlgitbridge.writelatex.api.request;

import com.ning.http.client.AsyncHttpClient;
import com.ning.http.client.Realm;
import com.ning.http.client.Response;

import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;

/**
 * Created by Winston on 06/11/14.
 */
public abstract class Request {

    private final String url;

    private Future<Response> response;
    private IOException exception;

    public Request(String url) {
        this.url = url;
    }

    protected abstract Realm buildRequestRealm();

    public void request() {
        AsyncHttpClient client = new AsyncHttpClient();
        try {
            response = client.prepareGet(url).setRealm(buildRequestRealm()).execute();
        } catch (IOException e) {
            exception = e;
        }
    }

    public String getResponse() throws IOException, ExecutionException, InterruptedException {
        if (exception != null) {
            throw exception;
        }
        return response.get().getResponseBody();
    }

}
