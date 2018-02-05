package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.git.exception.SnapshotAPIException;

import java.util.Arrays;
import java.util.List;

public class DisabledRepositoryException extends SnapshotAPIException {

    @Override
    public void fromJSON(JsonElement json) {}

    @Override
    public String getMessage() {
        return "project not accessible over git";
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList(getMessage());
    }

}
