package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.create;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

/**
 * Created by winston on 23/08/2016.
 */
public class CreateSwapTable implements SQLUpdate {

    private static final String CREATE_SWAP_TABLE =
            "CREATE TABLE IF NOT EXISTS `swap_table` (\n" +
            "        `project_name` VARCHAR NOT NULL DEFAULT '',\n" +
            "        `last_accessed` DATETIME NULL DEFAULT 0,\n" +
            "        PRIMARY KEY (`project_name`),\n" +
            "        CONSTRAINT `swap_table_fk_1`\n" +
            "            FOREIGN KEY (`project_name`)\n" +
            "            REFERENCES `projects`(`name`)\n" +
            "            ON DELETE CASCADE\n" +
            "            ON UPDATE CASCADE\n" +
            ")";

    @Override
    public String getSQL() {
        return CREATE_SWAP_TABLE;
    }

}
