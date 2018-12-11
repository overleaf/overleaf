package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.util.Util;

import java.util.Arrays;
import java.util.List;

/**
 * Created by Winston on 09/01/15.
 */
public class PostbackTimeoutException extends SevereSnapshotPostException {

    @Override
    public String getMessage() {
        return "timeout";
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList(
                "The "
                        + Util.getServiceName()
                        + " server is currently unavailable.",
                "Please try again later."
        );
    }

    @Override
    public void fromJSON(JsonElement json) {}

}
