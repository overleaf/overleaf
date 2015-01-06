package uk.ac.ic.wlgitbridge.bridge;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

import java.io.File;
import java.io.IOException;
import java.util.Date;

/**
 * Created by Winston on 14/11/14.
 */
public interface WritableRepositoryContents {

    public void write() throws IOException, FailedConnectionException;

    public File getDirectory();

    public String getUserName();
    public String getUserEmail();
    public String getCommitMessage();
    public Date getWhen();

}
