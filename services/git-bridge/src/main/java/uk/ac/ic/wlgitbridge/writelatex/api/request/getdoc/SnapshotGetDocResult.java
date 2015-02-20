package uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.ProtectedProjectException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetDocResult extends Result {

    private int error;
    private int versionID;
    private String createdAt;
    private String name;
    private String email;

    private SnapshotPostException exception;

    public SnapshotGetDocResult(Request request, JsonElement json) throws FailedConnectionException {
        super(request, json);
    }

    public SnapshotGetDocResult(JsonElement error, int versionID, String createdAt, String email, String name) {
        if (error == null) {
            this.error = -1;
        } else {
            this.error = error.getAsInt();
        }
        this.versionID = versionID;
        this.createdAt = createdAt;
        this.name = name;
        this.email = email;
    }

    @Override
    public JsonElement toJson() {
        JsonObject jsonThis = new JsonObject();
        if (error == -1) {
            jsonThis.addProperty("latestVerId", versionID);
            jsonThis.addProperty("latestVerAt", createdAt);
            JsonObject latestVerBy = new JsonObject();
            latestVerBy.addProperty("email", email);
            latestVerBy.addProperty("name", name);
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
            JsonElement latestVerBy = jsonObject.get("latestVerBy");
            if (latestVerBy.isJsonObject()) {
                JsonObject userObject = latestVerBy.getAsJsonObject();
                name = userObject.get("name").getAsString();
                email = userObject.get("email").getAsString();
            } else {
                name = "Anonymous";
                email = "anonymous@writelatex.com";
            }
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
        return name;
    }

    public String getEmail() {
        return email;
    }

}
