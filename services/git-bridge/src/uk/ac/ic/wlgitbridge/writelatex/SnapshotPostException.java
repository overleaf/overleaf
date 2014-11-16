package uk.ac.ic.wlgitbridge.writelatex;

import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public abstract class SnapshotPostException extends Exception {

    public abstract String getMessage();
    public abstract List<String> getDescriptionLines();

}
