package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.git.exception.SnapshotAPIException;

import java.util.Arrays;
import java.util.List;

public class MissingRepositoryException extends SnapshotAPIException {

    private String message = "";

    public MissingRepositoryException() {
    }

    public MissingRepositoryException(String message) {
        this.message = message;
    }

    @Override
    public void fromJSON(JsonElement json) {}

    @Override
    public String getMessage() {
        return message;
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList(getMessage());
    }

}
