package uk.ac.ic.wlgitbridge.writelatex;

import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class OutOfDateException extends SnapshotPostException {

    @Override
    public String getMessage() {
        return null;
    }

    @Override
    public List<String> getDescriptionLines() {
        return null;
    }

}
