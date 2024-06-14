package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.http.HttpRequest;

/*
 * Created by Winston on 06/11/14.
 */
public abstract class SnapshotAPIRequest<T extends Result> extends Request<T> {

  private static String BASE_URL;

  private final Credential oauth2;

  public SnapshotAPIRequest(String projectName, String apiCall, Credential oauth2) {
    super(BASE_URL + projectName + apiCall);
    this.oauth2 = oauth2;
  }

  @Override
  protected void onBeforeRequest(HttpRequest request) {
    if (oauth2 != null) {
      request.setInterceptor(
          request1 -> {
            oauth2.intercept(request1);
          });
    }
  }

  /* baseURL ends with / */
  public static void setBaseURL(String baseURL) {
    BASE_URL = baseURL + "docs/";
  }
}
