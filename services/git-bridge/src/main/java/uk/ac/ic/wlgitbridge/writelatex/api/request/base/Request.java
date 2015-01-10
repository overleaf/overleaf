package uk.ac.ic.wlgitbridge.writelatex.api.request.base;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.ning.http.client.AsyncCompletionHandler;
import com.ning.http.client.AsyncHttpClient;
import com.ning.http.client.AsyncHttpClient.BoundRequestBuilder;
import com.ning.http.client.Realm;
import com.ning.http.client.Response;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

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

    public void request() {
        switch (httpMethod()) {
            case GET:
                performGetRequest();
                break;
            case POST:
                performPostRequest();
                break;
            default:
                break;
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

    protected abstract HTTPMethod httpMethod();
    protected abstract Realm buildRequestRealm();
    protected abstract T parseResponse(JsonElement json) throws FailedConnectionException;

    protected String getPostBody() {
        return "";
    }

    private void performGetRequest() {
        System.out.println("GET -> " + url);
        request(new AsyncHttpClient().prepareGet(url));
    }

    private void performPostRequest() {
        System.out.println("POST -> " + url);
        request(new AsyncHttpClient().preparePost(url).setBody(getPostBody()).setHeader("Content-Type", "application/json"));
    }

    private void request(BoundRequestBuilder boundRequestBuilder) {
        future = boundRequestBuilder.setRealm(buildRequestRealm()).execute(new AsyncCompletionHandler<T>() {

            @Override
            public T onCompleted(Response response) throws Exception {
                String body = response.getResponseBody();
                System.out.println(response.getStatusText() + " (" + body.length() + " data bytes) -> " + url);
                return parseResponse(new Gson().fromJson(body, JsonElement.class));
            }

            @Override
            public void onThrowable(Throwable t) {
                t.printStackTrace();
                error = true;
            }

        });
    }

}
