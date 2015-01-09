package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class CreateURLIndexStoreSQLUpdate implements SQLUpdate {

    private static final String CREATE_URL_INDEX_STORE =
            "CREATE TABLE IF NOT EXISTS `url_index_store` (\n"+
            "  `project_name` varchar(10) NOT NULL DEFAULT '',\n"+
            "  `url` varchar(128) NOT NULL,\n"+
            "  `blob` blob NOT NULL,\n"+
            "  PRIMARY KEY (`project_name`,`url`),\n"+
            "  CONSTRAINT `url_index_store_ibfk_1` FOREIGN KEY (`project_name`) REFERENCES `projects` (`name`) ON DELETE CASCADE ON UPDATE CASCADE\n"+
            ")";

    @Override
    public String getSQL() {
        return CREATE_URL_INDEX_STORE;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {

    }

}
