package uk.ac.ic.wlgitbridge.writelatex;

import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.SnapshotPushRequest;
import uk.ac.ic.wlgitbridge.writelatex.model.WLDataModel;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class WriteLatexAPI implements WriteLatexDataSource {

    private final WLDataModel dataModel;

    public WriteLatexAPI(WLDataModel dataModel) {
        this.dataModel = dataModel;
    }

    @Override
    public boolean repositoryExists(String projectName) throws FailedConnectionException {
        SnapshotGetDocRequest snapshotGetDocRequest = new SnapshotGetDocRequest(projectName);
        snapshotGetDocRequest.request();
        try {
            snapshotGetDocRequest.getResult().getVersionID();
        } catch (InvalidProjectException e) {
            return false;
        }
        return true;
    }

    @Override
    public List<WritableRepositoryContents> getWritableRepositories(String projectName) throws FailedConnectionException, InvalidProjectException {
        return dataModel.updateProjectWithName(projectName);
    }

    @Override
    public void putDirectoryContentsToProjectWithName(String projectName, RawDirectoryContents directoryContents, String remoteAddr) throws SnapshotPostException, IOException, FailedConnectionException {
        CandidateSnapshot candidate = dataModel.createCandidateSnapshotFromProjectWithContents(projectName, directoryContents, remoteAddr);
        new SnapshotPushRequest(candidate).request();
        throw new SnapshotPostException() {

            @Override
            public String getMessage() {
                return "unimplemented";
            }

            @Override
            public List<String> getDescriptionLines() {
                return Arrays.asList("Currently implemented");
            }
        };
    }

    @Override
    public void expectPostback(String projectName) {

    }

    /* Called by postback thread. */
    @Override
    public void postbackReceived(String projectName) {

    }

}
