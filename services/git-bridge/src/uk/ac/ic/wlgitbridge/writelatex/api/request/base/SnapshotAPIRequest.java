package uk.ac.ic.wlgitbridge.writelatex.api.request.base;

import com.ning.http.client.Realm;

/**
 * Created by Winston on 06/11/14.
 */
public abstract class SnapshotAPIRequest<T extends Result> extends Request<T> {

    private static String USERNAME;
    private static String PASSWORD;

    private static String BASE_URL;

    public SnapshotAPIRequest(String projectName, String apiCall) {
        super(BASE_URL + "/" + projectName + apiCall);
    }

    protected Realm buildRequestRealm() {
        return new Realm.RealmBuilder()
                .setPrincipal(USERNAME)
                .setPassword(PASSWORD)
                .setUsePreemptiveAuth(true)
                .setScheme(Realm.AuthScheme.BASIC)
                .build();
    }

    public static void setBasicAuth(String username, String password) {
        USERNAME = username;
        PASSWORD = password;
    }

    public static void setBaseURL(String baseURL) {
        BASE_URL = baseURL;
    }

}
