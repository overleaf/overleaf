package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 21/02/15.
 */
public class CreateIndexURLIndexStore implements SQLUpdate {

    public static final String CREATE_INDEX_URL_INDEX_STORE =
            "CREATE UNIQUE INDEX IF NOT EXISTS `project_path_index` ON `url_index_store`(`project_name`, `path`);\n";

    @Override
    public String getSQL() {
        return CREATE_INDEX_URL_INDEX_STORE;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {

    }

}
