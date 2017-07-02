package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.api.client.http.*;
import com.google.gson.JsonElement;
import com.ning.http.client.AsyncHttpClient;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Instance;
import uk.ac.ic.wlgitbridge.util.Log;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.*;

/**
 * Created by Winston on 06/11/14.
 */
public abstract class Request<T extends Result> {

    public static final AsyncHttpClient httpClient = new AsyncHttpClient();

    private static final Executor executor = Executors.newCachedThreadPool();

    private final String url;

    private Future<HttpResponse> future;

    public Request(String url) {
        this.url = url;
    }

    public CompletableFuture<T> request() {
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
        CompletableFuture<T> ret = new CompletableFuture<>();
        executor.execute(() -> {
            try {
                ret.complete(getResult());
            } catch (Throwable t) {
                ret.completeExceptionally(t);
            }
        });
        return ret;
    }

    private T getResult() throws FailedConnectionException, ForbiddenException {
        try {
            HttpResponse response = future.get();
            Log.info(
                    "{} {} ({}B) -> " + url,
                    response.getStatusCode(),
                    response.getStatusMessage(),
                    response.getHeaders().getContentLength()
            );
            JsonElement json = Instance.gson.fromJson(
                    response.parseAsString(),
                    JsonElement.class
            );
            return parseResponse(json);
        } catch (InterruptedException e) {
            throw new FailedConnectionException();
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof HttpResponseException &&
                    (((HttpResponseException) cause).getStatusCode() ==
                            HttpServletResponse.SC_UNAUTHORIZED ||
                    ((HttpResponseException) cause).getStatusCode() ==
                            HttpServletResponse.SC_FORBIDDEN)) {
                throw new ForbiddenException();
            } else {
                throw new FailedConnectionException(cause);
            }
        } catch (IOException e) {
            Log.error("Failed to parse JSON.", e);
            throw new FailedConnectionException();
        }
    }

    protected abstract HTTPMethod httpMethod();

    protected void onBeforeRequest(HttpRequest request) throws IOException {

    }

    protected abstract
    T parseResponse(JsonElement json) throws FailedConnectionException;

    protected String getPostBody() {
        return null;
    }

    private void performGetRequest() {
        Log.info("GET -> " + url);
        try {
            HttpRequest request = Instance.httpRequestFactory.buildGetRequest(
                    new GenericUrl(url)
            );
            request(request);
        } catch (IOException e) {
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    private void performPostRequest() {
        Log.info("POST -> " + url);
        try {
            HttpRequest request = Instance.httpRequestFactory.buildPostRequest(
                    new GenericUrl(url),
                    new ByteArrayContent(
                            "application/json",
                            getPostBody().getBytes()
                    )
            );
            request(request);
        } catch (IOException e) {
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    private void request(HttpRequest request) throws IOException {
        onBeforeRequest(request);
        future = request.executeAsync();
    }

}
