package uk.ac.ic.wlgitbridge.writelatex.api.request.base;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

/**
 * Created by Winston on 06/11/14.
 */
public abstract class Result implements JSONSource {

    private JsonElement json;
    private final Request request;

    public Result(Request request, JsonElement json) throws FailedConnectionException {
        this.request = request;
        this.json = json;
        fromJSON(json);
    }

    public Request getRequest() {
        return request;
    }

    @Override
    public String toString() {
        return json.toString();
    }

}
