package uk.ac.ic.wlgitbridge.application.config;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.application.exception.ConfigFileException;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJobConfig;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStoreConfig;
import uk.ac.ic.wlgitbridge.snapshot.base.JSONSource;
import uk.ac.ic.wlgitbridge.util.Instance;

import javax.annotation.Nullable;
import java.io.FileReader;
import java.io.IOException;
import java.io.Reader;
import java.util.Optional;

/**
 * Created by Winston on 05/12/14.
 */
public class Config implements JSONSource {

    static Config asSanitised(Config config) {
        return new Config(
                config.port,
                config.rootGitDirectory,
                config.username,
                "<password>",
                config.apiBaseURL,
                config.postbackURL,
                config.serviceName,
                Oauth2.asSanitised(config.oauth2)
        );
    }

    private int port;
    private String rootGitDirectory;
    private String username;
    private String password;
    private String apiBaseURL;
    private String postbackURL;
    private String serviceName;
    @Nullable
    private Oauth2 oauth2;
    @Nullable
    private SwapStoreConfig swapStore;
    @Nullable
    private SwapJobConfig swapJob;

    public Config(String configFilePath) throws ConfigFileException,
                                                IOException {
        this(new FileReader(configFilePath));
    }

    Config(Reader reader) {
        fromJSON(new Gson().fromJson(reader, JsonElement.class));
    }

    public Config(int port,
                  String rootGitDirectory,
                  String username,
                  String password,
                  String apiBaseURL,
                  String postbackURL,
                  String serviceName,
                  Oauth2 oauth2) {
        this.port = port;
        this.rootGitDirectory = rootGitDirectory;
        this.username = username;
        this.password = password;
        this.apiBaseURL = apiBaseURL;
        this.postbackURL = postbackURL;
        this.serviceName = serviceName;
        this.oauth2 = oauth2;
    }

    @Override
    public void fromJSON(JsonElement json) {
        JsonObject configObject = json.getAsJsonObject();
        port = getElement(configObject, "port").getAsInt();
        rootGitDirectory = getElement(
                configObject,
                "rootGitDirectory"
        ).getAsString();
        username = getOptionalString(configObject, "username");
        password = getOptionalString(configObject, "password");
        String apiBaseURL = getElement(
                configObject,
                "apiBaseUrl"
        ).getAsString();
        if (!apiBaseURL.endsWith("/")) {
            apiBaseURL += "/";
        }
        this.apiBaseURL = apiBaseURL;
        serviceName = getElement(configObject, "serviceName").getAsString();
        postbackURL = getElement(configObject, "postbackBaseUrl").getAsString();
        if (!postbackURL.endsWith("/")) {
            postbackURL += "/";
        }
        oauth2 = new Gson().fromJson(configObject.get("oauth2"), Oauth2.class);
        swapStore = new Gson().fromJson(
                configObject.get("swapStore"),
                SwapStoreConfig.class
        );
        swapJob = new Gson().fromJson(
                configObject.get("swapJob"),
                SwapJobConfig.class
        );
    }

    public String getSanitisedString() {
        return Instance.prettyGson.toJson(Config.asSanitised(this));
    }

    public int getPort() {
        return port;
    }

    public String getRootGitDirectory() {
        return rootGitDirectory;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    public String getAPIBaseURL() {
        return apiBaseURL;
    }

    public String getServiceName() {
        return serviceName;
    }

    public String getPostbackURL() {
        return postbackURL;
    }

    public boolean isUsingOauth2() {
        return oauth2 != null;
    }

    public Oauth2 getOauth2() {
        if (!isUsingOauth2()) {
            throw new AssertionError("Getting oauth2 when not using it");
        }
        return oauth2;
    }

    public Optional<SwapStoreConfig> getSwapStore() {
        return Optional.ofNullable(swapStore);
    }

    public Optional<SwapJobConfig> getSwapJob() {
        return Optional.ofNullable(swapJob);
    }

    private JsonElement getElement(JsonObject configObject, String name) {
        JsonElement element = configObject.get(name);
        if (element == null) {
            throw new RuntimeException(new ConfigFileException(name));
        }
        return element;
    }

    private String getOptionalString(JsonObject configObject, String name) {
        JsonElement element = configObject.get(name);
        if (element == null || !element.isJsonPrimitive()) {
            return "";
        }
        return element.getAsString();
    }

}
