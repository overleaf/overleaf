package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.api.client.http.*;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.ning.http.client.AsyncCompletionHandler;
import com.ning.http.client.AsyncHttpClient;
import com.ning.http.client.Response;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Instance;
import uk.ac.ic.wlgitbridge.util.Util;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;

/**
 * Created by Winston on 06/11/14.
 */
public abstract class Request<T extends Result> {

    public static final AsyncHttpClient httpClient = new AsyncHttpClient();

    private final String url;

    private Future<HttpResponse> future;

    public Request(String url) {
        this.url = url;
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

    public T getResult() throws FailedConnectionException, ForbiddenException {
        try {
            HttpResponse response = future.get();
            Util.sout(response.getStatusCode() + " " + response.getStatusMessage() + " (" + response.getHeaders().getContentLength() + "B) -> " + url);
            JsonElement json = new Gson().fromJson(response.parseAsString(), JsonElement.class);
            return parseResponse(json);
        } catch (InterruptedException e) {
            throw new FailedConnectionException();
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof HttpResponseException && ((HttpResponseException) cause).getStatusCode() == HttpServletResponse.SC_FORBIDDEN) {
                throw new ForbiddenException();
            } else {
                throw new FailedConnectionException();
            }
        } catch (IOException e) {
            Util.serr("Failed to parse JSON");
            e.printStackTrace();
            throw new FailedConnectionException();
        }
    }

    protected abstract HTTPMethod httpMethod();

    protected void onBeforeRequest(HttpRequest request) throws IOException {

    }

    protected abstract T parseResponse(JsonElement json) throws FailedConnectionException;

    protected String getPostBody() {
        return null;
    }

    private void performGetRequest() {
        Util.sout("GET -> " + url);
        try {
            HttpRequest request = Instance.httpRequestFactory.buildGetRequest(new GenericUrl(url));
            request(request);
        } catch (IOException e) {
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    private void performPostRequest() {
        Util.sout("POST -> " + url);
        try {
            HttpRequest request = Instance.httpRequestFactory.buildPostRequest(new GenericUrl(url), new ByteArrayContent("application/json", getPostBody().getBytes()));
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
