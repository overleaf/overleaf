package uk.ac.ic.wlgitbridge.snapshot.base;

import static org.asynchttpclient.Dsl.*;

import com.google.api.client.http.*;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.io.IOException;
import java.util.Arrays;
import java.util.concurrent.*;
import org.asynchttpclient.AsyncHttpClient;
import org.eclipse.jetty.http.HttpStatus;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Instance;
import uk.ac.ic.wlgitbridge.util.Log;

/*
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
    executor.execute(
        () -> {
          try {
            ret.complete(getResult());
          } catch (Throwable t) {
            ret.completeExceptionally(t);
          }
        });
    return ret;
  }

  private T getResult()
      throws MissingRepositoryException, FailedConnectionException, ForbiddenException {
    try {
      HttpResponse response = future.get();
      Log.debug(
          "{} {} ({}B) -> " + url,
          response.getStatusCode(),
          response.getStatusMessage(),
          response.getHeaders().getContentLength());
      JsonElement json = Instance.gson.fromJson(response.parseAsString(), JsonElement.class);
      return parseResponse(json);
    } catch (InterruptedException e) {
      throw new FailedConnectionException();
    } catch (ExecutionException e) {
      Throwable cause = e.getCause();
      if (cause instanceof HttpResponseException) {
        HttpResponseException httpCause = (HttpResponseException) cause;
        int sc = httpCause.getStatusCode();
        if (sc == HttpStatus.UNAUTHORIZED_401 || sc == HttpStatus.FORBIDDEN_403) {
          throw new ForbiddenException();
        } else if (sc == HttpStatus.TOO_MANY_REQUESTS_429) {
          throw new MissingRepositoryException(
              Arrays.asList(
                  "Rate-limit exceeded. Please wait a while and try again.",
                  "",
                  "If this is unexpected, please contact us at support@overleaf.com, or",
                  "see https://www.overleaf.com/learn/how-to/Git_integration for more information."));
        } else if (sc == HttpStatus.CONFLICT_409) {
          try {
            JsonObject json = Instance.gson.fromJson(httpCause.getContent(), JsonObject.class);
            String code = json.get("code").getAsString();
            if ("projectHasDotGit".equals(code)) {
              throw new MissingRepositoryException(
                  Arrays.asList(
                      "This project contains a '.git' entity at the top level, indicating that it is",
                      "already a git repository. The Overleaf git-bridge cannot work with this project",
                      "due to a known problem with handling these '.git' folders.",
                      "",
                      "We recommend removing the .git folder before trying again.",
                      "",
                      "If this is unexpected, please contact us at support@overleaf.com, or",
                      "see https://www.overleaf.com/learn/how-to/Git_integration for more information."));
            } else {
              throw new MissingRepositoryException(Arrays.asList("Conflict: 409"));
            }
          } catch (IllegalStateException
              | ClassCastException
              | NullPointerException _e) { // json parse errors
            throw new MissingRepositoryException(Arrays.asList("Conflict: 409"));
          }
        } else if (sc == HttpStatus.NOT_FOUND_404) {
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
                  MissingRepositoryException.buildExportedToV2Message(newRemote));
            } else if ("Overleaf v1 is Deprecated".equals(message)) {
              String newUrl;
              if (json.has("newUrl")) {
                newUrl = json.get("newUrl").getAsString();
              } else {
                newUrl = null;
              }
              throw new MissingRepositoryException(
                  MissingRepositoryException.buildDeprecatedMessage(newUrl));
            }
          } catch (IllegalStateException | ClassCastException | NullPointerException ex) {
            // disregard any errors that arose while handling the JSON
          }

          throw new MissingRepositoryException();
        } else if (sc >= 400 && sc < 500) {
          throw new MissingRepositoryException(MissingRepositoryException.GENERIC_REASON);
        }
        throw new FailedConnectionException(cause);
      } else {
        throw new FailedConnectionException(cause);
      }
    } catch (IOException e) {
      Log.warn("Failed to parse JSON.", e);
      throw new FailedConnectionException();
    }
  }

  protected abstract HTTPMethod httpMethod();

  protected void onBeforeRequest(HttpRequest request) throws IOException {}

  protected abstract T parseResponse(JsonElement json) throws FailedConnectionException;

  protected String getPostBody() {
    return null;
  }

  private void performGetRequest() {
    Log.debug("GET -> " + url);
    try {
      HttpRequest request = Instance.httpRequestFactory.buildGetRequest(new GenericUrl(url));
      setTimeouts(request);
      request(request);
    } catch (IOException e) {
      e.printStackTrace();
      throw new RuntimeException(e);
    }
  }

  private void performPostRequest() {
    Log.debug("POST -> " + url);
    try {
      HttpRequest request =
          Instance.httpRequestFactory.buildPostRequest(
              new GenericUrl(url),
              new ByteArrayContent("application/json", getPostBody().getBytes()));
      setTimeouts(request);
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

  private void setTimeouts(HttpRequest request) {
    // timeouts are 20s by default
    int threeMinutesInMs = 1000 * 60 * 3;
    request.setReadTimeout(threeMinutesInMs);
  }
}
