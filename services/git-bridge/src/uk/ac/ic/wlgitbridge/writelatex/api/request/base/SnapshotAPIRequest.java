package uk.ac.ic.wlgitbridge.writelatex.api.request.base;

import com.ning.http.client.Realm;

/**
 * Created by Winston on 06/11/14.
 */
public abstract class SnapshotAPIRequest<T extends Result> extends Request<T> {

    private static final String USERNAME = "staging";
    private static final String PASSWORD = "6kUfbv0R";

    private static final String BASE_URL = "https://radiant-wind-3058.herokuapp.com/api/v0/docs";

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

}
