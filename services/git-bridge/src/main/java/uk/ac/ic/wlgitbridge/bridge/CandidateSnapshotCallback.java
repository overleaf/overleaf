package uk.ac.ic.wlgitbridge.bridge;

import uk.ac.ic.wlgitbridge.writelatex.CandidateSnapshot;

/**
 * Created by Winston on 16/11/14.
 */
public interface CandidateSnapshotCallback {

    public void approveSnapshot(int versionID, CandidateSnapshot candidateSnapshot);

}
