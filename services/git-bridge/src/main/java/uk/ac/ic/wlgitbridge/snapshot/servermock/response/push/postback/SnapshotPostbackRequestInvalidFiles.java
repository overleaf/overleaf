package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback.invalidfile.InvalidFileError;

import java.util.ArrayList;
import java.util.List;

/**
 * Created by Winston on 09/01/15.
 */
public class SnapshotPostbackRequestInvalidFiles extends SnapshotPostbackRequest {

    private final List<InvalidFileError> errors;

    public SnapshotPostbackRequestInvalidFiles(List<InvalidFileError> errors) {
        super("invalidFiles");
        this.errors = errors;
    }

    public SnapshotPostbackRequestInvalidFiles(JsonArray errors) {
        this(new ArrayList<InvalidFileError>());
        for (JsonElement error : errors) {
            this.errors.add(InvalidFileError.buildFromJsonError(
                    error.getAsJsonObject()
            ));
        }
    }

    @Override
    public JsonObject toJson() {
        JsonObject jsonThis = super.toJson();
        JsonArray jsonErrors = new JsonArray();
        for (InvalidFileError error : errors) {
            jsonErrors.add(error.toJson());
        }
        jsonThis.add("errors", jsonErrors);
        return jsonThis;
    }

}
