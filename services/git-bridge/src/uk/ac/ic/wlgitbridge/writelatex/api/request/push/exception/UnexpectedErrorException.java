package uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.Arrays;
import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class UnexpectedErrorException extends SnapshotPostException {

    public UnexpectedErrorException(JsonObject json) {
        super(json);
    }

    @Override
    public String getMessage() {
        return "unexpected error";
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList("writelatex error");
    }

    @Override
    public void fromJSON(JsonElement json) {

    }

}
