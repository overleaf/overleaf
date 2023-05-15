package uk.ac.ic.wlgitbridge.server;

import com.google.api.client.auth.oauth2.*;
import com.google.api.client.http.GenericUrl;
import com.google.api.client.http.HttpHeaders;
import com.google.api.client.http.HttpRequest;
import com.google.api.client.http.HttpResponse;
import org.apache.commons.codec.binary.Base64;
import org.eclipse.jetty.server.Request;
import uk.ac.ic.wlgitbridge.application.config.Oauth2;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotApi;
import uk.ac.ic.wlgitbridge.snapshot.base.MissingRepositoryException;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocRequest;
import uk.ac.ic.wlgitbridge.util.Instance;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.util.*;

/**
 * Created by winston on 25/10/15.
 */
public class Oauth2Filter implements Filter {

    public static final String ATTRIBUTE_KEY = "oauth2";

    private final SnapshotApi snapshotApi;

    private final Oauth2 oauth2;

    private final boolean isUserPasswordEnabled;

    public Oauth2Filter(SnapshotApi snapshotApi, Oauth2 oauth2, boolean isUserPasswordEnabled) {
        this.snapshotApi = snapshotApi;
        this.oauth2 = oauth2;
        this.isUserPasswordEnabled = isUserPasswordEnabled;
    }

    @Override
    public void init(FilterConfig filterConfig) {}

    /**
     * The original request from git will not contain the Authorization header.
     *
     * So, for projects that need auth, we return 401. Git will swallow this
     * and prompt the user for user/pass, and then make a brand new request.
     * @param servletRequest
     * @param servletResponse
     * @param filterChain
     * @throws IOException
     * @throws ServletException
     */
    @Override
    public void doFilter(
        ServletRequest servletRequest,
        ServletResponse servletResponse,
        FilterChain filterChain
    ) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;
        String requestUri = request.getRequestURI();

        if (requestUri.startsWith("/project")) {
            Log.info("[{}] Invalid request URI", requestUri);
            sendResponse(response,404, Arrays.asList(
                "Invalid Project ID (must not have a '/project' prefix)"
            ));
            return;
        }

        String projectId = Util.removeAllSuffixes(requestUri.split("/")[1], ".git");

        BasicAuthCredentials basicAuthCreds = getBasicAuthCredentials(request);
        if (basicAuthCreds == null) {
            handleNeedAuthorization(projectId, "(unknown)", request, response);
            return;
        }
        String username = basicAuthCreds.getUsername();
        String password = basicAuthCreds.getPassword();

        if (isLinkSharingId(projectId)) {
            handleLinkSharingId(projectId, username, request, response);
            return;
        }
        if (!isProjectId(projectId)) {
            handleBadProjectId(projectId, username, request, response);
            return;
        }

        final Credential cred = new Credential.Builder(
            BearerToken.authorizationHeaderAccessMethod()
        ).build();

        if (username.equals("git")) {
            Log.debug("[{}] username is 'git', skipping password grant flow", projectId);

            // Check that the access token is valid. In principle, we could
            // wait until we make the actual request to the web api, but the
            // JGit API doesn't make it easy to reply with a 401 and a custom
            // error message. This is something we can do in this filter, so as
            // a workaround, we use the /oauth/token/info endpoint to verify
            // the access token.
            //
            // It's still theoretically possible for the web api request to
            // fail later (for example, in the unlikely event that the token
            // expired between the two requests). In that case, JGit will
            // return a 401 without a custom error message.
            int statusCode = checkAccessToken(oauth2, password, getClientIp(request));
            if (statusCode == 429) {
                handleRateLimit(projectId, username, request, response);
                return;
            } else if (statusCode == 401) {
                handleBadAccessToken(projectId, request, response);
                return;
            } else if (statusCode >= 400) {
                handleUnknownOauthServerError(projectId, statusCode, request, response);
                return;
            }
            cred.setAccessToken(password);
        } else if (this.isUserPasswordEnabled) {
            String accessToken = null;
            try {
                accessToken = doPasswordGrantFlow(username, password, getClientIp(request));
            } catch (TokenResponseException e) {
                int statusCode = e.getStatusCode();
                if (statusCode == 429) {
                    handleRateLimit(projectId, username, request, response);
                } else if (statusCode == 400 || statusCode == 401) {
                    handleNeedAuthorization(projectId, username, request, response);
                } else {
                    handleUnknownOauthServerError(projectId, statusCode, request, response);
                }
                return;
            }
            cred.setAccessToken(accessToken);
        } else {
            handleNeedAuthorization(projectId, username, request, response);
            return;
        }

        servletRequest.setAttribute(ATTRIBUTE_KEY, cred);
        filterChain.doFilter(
            servletRequest,
            servletResponse
        );
    }

    @Override
    public void destroy() {}

    private boolean isLinkSharingId(String projectId) {
        return projectId.matches("^[0-9]+[bcdfghjklmnpqrstvwxyz]{6,12}$");
    }

    private boolean isProjectId(String projectId) {
        return projectId.matches("^[0-9a-f]{24}$");
    }

    private void sendResponse(HttpServletResponse response, int code, List<String> lines) throws IOException {
        response.setContentType("text/plain");
        response.setStatus(code);
        PrintWriter w = response.getWriter();
        for (String line : lines) {
            w.println(line);
        }
        w.close();
    }

    private void handleLinkSharingId(
        String projectId,
        String username,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws IOException {
        Log.info(
            "[{}] Bad project id, User '{}' ip={}",
            projectId,
            username,
            getClientIp(request)
        );
        sendResponse(response, 404, Arrays.asList(
            "Git access via link sharing link is not supported.",
            "",
            "You can find the project's git remote url by opening it in your browser",
            "and selecting Git from the left sidebar in the project view.",
            "",
            "If this is unexpected, please contact us at support@overleaf.com, or",
            "see https://www.overleaf.com/help/342 for more information."
        ));
    }

    private void handleBadProjectId(
        String projectId,
        String username,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws IOException {
        Log.info(
            "[{}] Bad project id, User '{}' ip={}",
            projectId,
            username,
            getClientIp(request)
        );
        sendResponse(response, 404, Arrays.asList(
            "This Overleaf project does not exist.",
            "",
            "If this is unexpected, please contact us at support@overleaf.com, or",
            "see https://www.overleaf.com/help/342 for more information."
        ));
    }

    private void handleRateLimit(
        String projectId,
        String username,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws IOException {
        Log.info(
            "[{}] Rate limit, User '{}' ip={}",
            projectId,
            username,
            getClientIp(request)
        );
        sendResponse(response, 429, Arrays.asList(
            "Rate limit exceeded. Please wait and try again later."
        ));
    }

    private void handleNeedAuthorization(
        String projectId,
        String username,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws IOException {
        Log.info(
            "[{}] Unauthorized, User '{}' ip={}",
            projectId,
            username,
            getClientIp(request)
        );
        response.setHeader("WWW-Authenticate", "Basic realm=\"Git Bridge\"");
        if (this.isUserPasswordEnabled) {
            sendResponse(response, 401, Arrays.asList(
                "Log in using the email address and password you use for Overleaf.",
                "",
                "*Note*: if you use a provider such as Google or Twitter to sign into",
                "your Overleaf account, you will need to set a password.",
                "",
                "See our help page for more support:",
                "https://www.overleaf.com/learn/how-to/Troubleshooting_git_bridge_problems"
            ));
        } else {
            sendResponse(response, 401, Arrays.asList(
                "Log in with the username 'git' and enter your Git authentication token",
                "when prompted for a password.",
                "",
                "You can generate and manage your Git authentication tokens in",
                "your Overleaf Account Settings."
            ));
        }
    }

    private void handleBadAccessToken(
        String projectId,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws IOException {
        Log.info(
            "[{}] Bad access token, ip={}",
            projectId,
            getClientIp(request)
        );
        sendResponse(response, 401, Arrays.asList(
            "Enter your Git authentication token when prompted for a password.",
            "",
            "You can generate and manage your Git authentication tokens in",
            "your Overleaf Account Settings."
        ));
    }

    private int checkAccessToken(
        Oauth2 oauth2,
        String accessToken,
        String clientIp
    ) throws IOException {
        GenericUrl url = new GenericUrl(
            oauth2.getOauth2Server() + "/oauth/token/info?client_ip=" + clientIp
        );
        HttpRequest request = Instance.httpRequestFactory.buildGetRequest(url);
        HttpHeaders headers = new HttpHeaders();
        headers.setAuthorization("Bearer " + accessToken);
        request.setHeaders(headers);
        request.setThrowExceptionOnExecuteError(false);
        HttpResponse response = request.execute();
        int statusCode = response.getStatusCode();
        response.disconnect();
        return statusCode;
    }

    private void handleUnknownOauthServerError(
        String projectId,
        int statusCode,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws IOException {
        Log.info(
            "[{}] OAuth server error, statusCode={}, ip={}",
            projectId,
            statusCode,
            getClientIp(request)
        );
        sendResponse(response, 500, Arrays.asList(
            "Unexpected server error. Please try again later."
        ));
    }

    /**
     * Gets the remote IP from the request.
     */
    private String getClientIp(HttpServletRequest request) {
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null) {
            clientIp = request.getRemoteAddr();
        }
        return clientIp;
    }

    /**
     * Extract basic auth credentials from the request.
     *
     * Returns null if valid basic auth credentials couldn't be found.
     */
    private BasicAuthCredentials getBasicAuthCredentials(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null) {
            return null;
        }

        StringTokenizer st = new StringTokenizer(authHeader);
        if (!st.hasMoreTokens()) {
            return null;
        }
        String basic = st.nextToken();
        if (!basic.equalsIgnoreCase("Basic")) {
            return null;
        }

        String credentials = null;
        try {
            credentials = new String(
                Base64.decodeBase64(st.nextToken()),
                "UTF-8"
            );
        } catch (UnsupportedEncodingException e) {
            return null;
        }

        String[] split = credentials.split(":", 2);
        if (split.length != 2) {
            return null;
        }
        String username = split[0];
        String password = split[1];
        return new BasicAuthCredentials(username, password);
    }

    /**
     * Perform a password grant flow with the OAuth server and return an access token.
     *
     * The access token is null if the password grant flow was unsuccessful.
     */
    private String doPasswordGrantFlow(
        String username,
        String password,
        String clientIp
    ) throws IOException {
        return new PasswordTokenRequest(
            Instance.httpTransport,
            Instance.jsonFactory,
            new GenericUrl(
                oauth2.getOauth2Server()
                + "/oauth/token?client_ip="
                + clientIp
            ),
            username,
            password
        ).setClientAuthentication(
            new ClientParametersAuthentication(
                oauth2.getOauth2ClientID(),
                oauth2.getOauth2ClientSecret()
            )
        ).execute().getAccessToken();
    }
}
