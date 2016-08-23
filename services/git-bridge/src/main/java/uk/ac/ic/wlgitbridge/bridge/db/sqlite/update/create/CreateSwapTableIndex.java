package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.create;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

/**
 * Created by winston on 23/08/2016.
 */
public class CreateSwapTableIndex implements SQLUpdate {

    private static final String CREATE_SWAP_TABLE_INDEX =
            "CREATE INDEX IF NOT EXISTS `swap_table_index`\n" +
            "    ON `swap_table`(`last_accessed`)";

    @Override
    public String getSQL() {
        return CREATE_SWAP_TABLE_INDEX;
    }

}
