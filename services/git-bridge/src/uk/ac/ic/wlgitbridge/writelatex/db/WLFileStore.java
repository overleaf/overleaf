package uk.ac.ic.wlgitbridge.writelatex.db;

import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 08/11/14.
 */
public class WLFileStore {

    private final Map<String, WLFileNode> fileStore;

    public WLFileStore() {
        fileStore = new HashMap<String, WLFileNode>();
    }



}
