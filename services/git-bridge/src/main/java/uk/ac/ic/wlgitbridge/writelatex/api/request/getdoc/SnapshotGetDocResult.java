package uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetDocResult extends Result {

    private int versionID;
    private String createdAt;
    private String name;
    private String email;

    private InvalidProjectException invalidProjectException;

    public SnapshotGetDocResult(Request request, JsonElement json) throws FailedConnectionException {
        super(request, json);
    }

    public SnapshotGetDocResult(int versionID, String createdAt, String email, String name) {
        this.versionID = versionID;
        this.createdAt = createdAt;
        this.name = name;
        this.email = email;
    }

    @Override
    public JsonElement toJson() {
        JsonObject jsonThis = new JsonObject();
        jsonThis.addProperty("latestVerId", versionID);
        jsonThis.addProperty("latestVerAt", createdAt);
        JsonObject latestVerBy = new JsonObject();
        latestVerBy.addProperty("email", email);
        latestVerBy.addProperty("name", name);
        jsonThis.add("latestVerBy", latestVerBy);
        return jsonThis;
    }

    @Override
    public void fromJSON(JsonElement json) {
        JsonObject jsonObject = json.getAsJsonObject();
        if (jsonObject.has("status") && jsonObject.get("status").getAsInt() == 404) {
            invalidProjectException = new InvalidProjectException();
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

    public int getVersionID() throws InvalidProjectException {
        if (invalidProjectException != null) {
            throw invalidProjectException;
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
