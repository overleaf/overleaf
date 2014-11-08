package uk.ac.ic.wlgitbridge.writelatex.api.request.base;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.ning.http.client.AsyncCompletionHandler;
import com.ning.http.client.AsyncHttpClient;
import com.ning.http.client.Realm;
import com.ning.http.client.Response;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;

/**
 * Created by Winston on 06/11/14.
 */
public abstract class Request<T extends Result> {

    private final String url;

    private Future<T> future;
    private boolean error;

    public Request(String url) {
        this.url = url;
        error = false;
    }

    protected abstract Realm buildRequestRealm();
    protected abstract T parseResponse(JsonElement json) throws FailedConnectionException;

    public void request() {
        AsyncHttpClient client = new AsyncHttpClient();
        try {
            future = client.prepareGet(url).setRealm(buildRequestRealm()).execute(new AsyncCompletionHandler<T>() {

                @Override
                public T onCompleted(Response response) throws Exception {
                    return parseResponse(new Gson().fromJson(response.getResponseBody(), JsonElement.class));
                }

                @Override
                public void onThrowable(Throwable t) {
                    error = true;
                }

            });
        } catch (IOException e) {
            error = true;
        }
    }

    public T getResult() throws FailedConnectionException {
        if (error) {
            throw new FailedConnectionException();
        }
        try {
            return future.get();
        } catch (InterruptedException e) {
            throw new FailedConnectionException();
        } catch (ExecutionException e) {
            throw new FailedConnectionException();
        }
    }

}
