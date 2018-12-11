package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.api.client.http.*;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.asynchttpclient.AsyncHttpClient;
import static org.asynchttpclient.Dsl.*;
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

    public static final AsyncHttpClient httpClient = asyncHttpClient();

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

    private T getResult() throws MissingRepositoryException, FailedConnectionException, ForbiddenException {
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
            if (cause instanceof HttpResponseException) {
                HttpResponseException httpCause = (HttpResponseException) cause;
                int sc = httpCause.getStatusCode();
                if (sc == HttpServletResponse.SC_UNAUTHORIZED || sc == HttpServletResponse.SC_FORBIDDEN) {
                    throw new ForbiddenException();
                } else if (sc == HttpServletResponse.SC_NOT_FOUND) {
                    try {
                        JsonObject json = Instance.gson.fromJson(httpCause.getContent(), JsonObject.class);
                        String message = json.get("message").getAsString();
                        String newRemote;
                        if (json.has("newRemote")) {
                            newRemote = json.get("newRemote").getAsString();
                        } else {
                            newRemote = null;
                        }

                        if ("Exported to v2".equals(message)) {
                            throw new MissingRepositoryException(
                                MissingRepositoryException.buildExportedToV2Message(newRemote)
                            );
                        }
                    } catch (IllegalStateException
                            | ClassCastException
                            | NullPointerException _) {
                        // disregard any errors that arose while handling the JSON
                    }

                    throw new MissingRepositoryException(MissingRepositoryException.GENERIC_REASON);
                } else if (sc >= 400 && sc < 500) {
                    throw new MissingRepositoryException(MissingRepositoryException.GENERIC_REASON);
                }
                throw new FailedConnectionException(cause);
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
