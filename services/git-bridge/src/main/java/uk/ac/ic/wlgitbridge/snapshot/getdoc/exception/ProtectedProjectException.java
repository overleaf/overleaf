package uk.ac.ic.wlgitbridge.snapshot.getdoc.exception;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;

import java.util.Arrays;
import java.util.List;

/**
 * Created by Winston on 20/02/15.
 */
public class ProtectedProjectException extends SnapshotPostException {

    @Override
    public String getMessage() {
        return "Your project is protected, and can't be cloned (yet).";
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList("You can't currently clone a protected project.");
    }

    @Override
    public void fromJSON(JsonElement json) {

    }

}
