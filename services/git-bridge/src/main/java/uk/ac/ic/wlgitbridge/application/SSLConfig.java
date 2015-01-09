package uk.ac.ic.wlgitbridge.application;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;

/**
 * Created by Winston on 05/01/15.
 */
public class SSLConfig implements JSONSource {

    private boolean enabled;

    public SSLConfig(JsonObject ssl) {
        fromJSON(ssl);
    }

    @Override
    public void fromJSON(JsonElement json) {
        JsonObject obj = json.getAsJsonObject();
        enabled = obj.get("enabled").getAsJsonPrimitive().getAsBoolean();
    }

    public boolean isEnabled() {
        return enabled;
    }

}
