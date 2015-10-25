package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.http.BasicAuthentication;
import com.google.api.client.http.HttpExecuteInterceptor;
import com.google.api.client.http.HttpRequest;
import com.ning.http.client.Realm;

import java.io.IOException;

/**
 * Created by Winston on 06/11/14.
 */
public abstract class SnapshotAPIRequest<T extends Result> extends Request<T> {

    private static String USERNAME;
    private static String PASSWORD;

    private static String BASE_URL;

    private final Credential oauth2;

    public SnapshotAPIRequest(String projectName, String apiCall, Credential oauth2) {
        super(BASE_URL + projectName + apiCall);
        this.oauth2 = oauth2;
    }

    @Override
    protected void onBeforeRequest(HttpRequest request) throws IOException {
        request.setInterceptor(new HttpExecuteInterceptor() {

            @Override
            public void intercept(HttpRequest request) throws IOException {
                new BasicAuthentication(USERNAME, PASSWORD).intercept(request);
                if (oauth2 != null) {
                    oauth2.intercept(request);
                }
            }

        });
    }

    public static void setBasicAuth(String username, String password) {
        USERNAME = username;
        PASSWORD = password;
    }

    /* baseURL ends with / */
    public static void setBaseURL(String baseURL) {
        BASE_URL = baseURL + "docs/";
    }

}
