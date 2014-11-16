package uk.ac.ic.wlgitbridge.bridge;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface WriteLatexDataSource {

    public boolean repositoryExists(String name) throws FailedConnectionException;
    public List<WritableRepositoryContents> getWritableRepositories(String name) throws FailedConnectionException, InvalidProjectException;
    public CandidateSnapshot createCandidateSnapshot(RawDirectoryContents rawDirectoryContents);
    public void approveCandidateSnapshot(CandidateSnapshot candidateSnapshot);

}
