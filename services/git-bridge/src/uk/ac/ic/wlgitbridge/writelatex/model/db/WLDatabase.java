package uk.ac.ic.wlgitbridge.writelatex.model.db;

import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProjectStore;

/**
 * Created by Winston on 17/11/14.
 */
public interface WLDatabase {

    public WLProjectStore loadProjectStore();
    public WLFileStore loadFileStore();

}
