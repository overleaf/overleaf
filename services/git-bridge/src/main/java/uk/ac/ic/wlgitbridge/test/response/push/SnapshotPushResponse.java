package uk.ac.ic.wlgitbridge.test.response.push;

import uk.ac.ic.wlgitbridge.test.response.SnapshotResponse;
import uk.ac.ic.wlgitbridge.test.response.push.postback.SnapshotPostbackRequest;
import uk.ac.ic.wlgitbridge.test.response.push.data.SnapshotPushResult;

/**
 * Created by Winston on 09/01/15.
 */
public class SnapshotPushResponse extends SnapshotResponse {

    private final SnapshotPushResult stateForPush;
    private final SnapshotPostbackRequest stateForPostback;

    public SnapshotPushResponse(SnapshotPushResult stateForPush, SnapshotPostbackRequest stateForPostback) {
        this.stateForPush = stateForPush;
        this.stateForPostback = stateForPostback;
    }

    @Override
    public String respond() {
        return stateForPush.toJson().toString();
    }

    @Override
    public String postback() {
        if (stateForPush.hasPostback()) {
            return stateForPostback.toJson().toString();
        } else {
            return null;
        }
    }

}
