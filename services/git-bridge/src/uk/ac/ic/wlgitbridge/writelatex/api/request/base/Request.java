package uk.ac.ic.wlgitbridge.writelatex.api.request.base;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.ning.http.client.AsyncCompletionHandler;
import com.ning.http.client.AsyncHttpClient;
import com.ning.http.client.Realm;
import com.ning.http.client.Response;

import java.io.IOException;
import java.util.concurrent.Future;

/**
 * Created by Winston on 06/11/14.
 */
public abstract class Request<T extends Result> {

    private final String url;

    private Future<T> future;
    private Throwable throwable;

    private boolean finished;

    public Request(String url) {
        this.url = url;
        finished = false;
    }

    protected abstract Realm buildRequestRealm();
    protected abstract T parseResponse(JsonElement json);

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
                    throwable = t;
                }

            });
        } catch (IOException e) {
            throwable = e;
        }
    }

    public T getResult() throws Throwable {
        if (throwable != null) {
            throw throwable;
        }
        return future.get();
    }

}
