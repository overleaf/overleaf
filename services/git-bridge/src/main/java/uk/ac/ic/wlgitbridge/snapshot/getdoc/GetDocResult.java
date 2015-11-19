package uk.ac.ic.wlgitbridge.snapshot.getdoc;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.snapshot.base.Result;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.WLUser;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.snapshot.base.Request;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.exception.ProtectedProjectException;

/**
 * Created by Winston on 06/11/14.
 */
public class GetDocResult extends Result {

    private int error;
    private int versionID;
    private String createdAt;
    private WLUser user;

    private SnapshotPostException exception;

    public GetDocResult(Request request, JsonElement json) throws FailedConnectionException {
        super(request, json);
    }

    public GetDocResult(JsonElement error, int versionID, String createdAt, String email, String name) {
        if (error == null) {
            this.error = -1;
        } else {
            this.error = error.getAsInt();
        }
        this.versionID = versionID;
        this.createdAt = createdAt;
        this.user = new WLUser(name, email);
    }

    @Override
    public JsonElement toJson() {
        JsonObject jsonThis = new JsonObject();
        if (error == -1) {
            jsonThis.addProperty("latestVerId", versionID);
            jsonThis.addProperty("latestVerAt", createdAt);
            JsonObject latestVerBy = new JsonObject();
            latestVerBy.addProperty("email", getEmail());
            latestVerBy.addProperty("name", getName());
            jsonThis.add("latestVerBy", latestVerBy);
        } else {
            jsonThis.addProperty("status", error);
            String message;
            if (error == 403) {
                message = "Forbidden";
            } else {
                message = "Not Found";
            }
            jsonThis.addProperty("message", message);
        }
        return jsonThis;
    }

    @Override
    public void fromJSON(JsonElement json) {
        JsonObject jsonObject = json.getAsJsonObject();
        if (jsonObject.has("status")) {
            switch (jsonObject.get("status").getAsInt()) {
            case 401:
            case 403:
                exception = new ProtectedProjectException();
                break;
            case 404:
                exception = new InvalidProjectException();
                break;
            default:
                throw new IllegalArgumentException("unknown get doc error code");
            }
        } else {
            versionID = jsonObject.get("latestVerId").getAsInt();
            createdAt = jsonObject.get("latestVerAt").getAsString();
            String name = null;
            String email = null;
            JsonElement latestVerBy = jsonObject.get("latestVerBy");

            if (latestVerBy.isJsonObject()) {
                JsonObject userObject = latestVerBy.getAsJsonObject();
                name = userObject.get("name").getAsString();
                email = userObject.get("email").getAsString();
            }

            user = new WLUser(name, email);
        }
    }

    public int getVersionID() throws SnapshotPostException {
        if (exception != null) {
            throw exception;
        }
        return versionID;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public String getName() {
        return user.getName();
    }

    public String getEmail() {
        return user.getEmail();
    }

}
