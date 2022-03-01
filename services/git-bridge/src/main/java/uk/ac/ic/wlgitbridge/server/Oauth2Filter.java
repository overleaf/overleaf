package uk.ac.ic.wlgitbridge.server;

import com.google.api.client.auth.oauth2.*;
import com.google.api.client.http.GenericUrl;
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

    public Oauth2Filter(SnapshotApi snapshotApi, Oauth2 oauth2) {
        this.snapshotApi = snapshotApi;
        this.oauth2 = oauth2;
    }

    @Override
    public void init(FilterConfig filterConfig) {}

    private void sendResponse(ServletResponse servletResponse, int code, List<String> lines) throws IOException {
        HttpServletResponse response = ((HttpServletResponse) servletResponse);
        response.setContentType("text/plain");
        response.setStatus(code);
        PrintWriter w = response.getWriter();
        for (String line : lines) {
            w.println(line);
        }
        w.close();
        return;
    }

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
        String requestUri = ((Request) servletRequest).getRequestURI();
        if (requestUri.startsWith("/project")) {
            Log.info("[{}] Invalid request URI", requestUri);
            sendResponse(servletResponse,404, Arrays.asList(
                    "Invalid Project ID (must not have a '/project' prefix)"
            ));
            return;
        }
        String project = Util.removeAllSuffixes(
                requestUri.split("/")[1],
                ".git"
        );
        // Reject v1 ids, the request will be rejected by v1 anyway
        if (project.matches("^[0-9]+[bcdfghjklmnpqrstvwxyz]{6,12}$") && !project.matches("^[0-9a-f]{24}$")) {
            Log.info("[{}] Request for v1 project, refusing", project);
            sendResponse(servletResponse, 404, Arrays.asList(
                    "This project has not yet been moved into the new version",
                    "of Overleaf. You will need to move it in order to continue working on it.",
                    "Please visit this project online on www.overleaf.com to do this.",
                    "",
                    "You can find the new git remote url by selecting \"Git\" from",
                    "the left sidebar in the project view.",
                    "",
                    "If this is unexpected, please contact us at support@overleaf.com, or",
                    "see https://www.overleaf.com/help/342 for more information."
            ));
            return;
        }
        Log.debug("[{}] Checking if auth needed", project);
        GetDocRequest doc = new GetDocRequest(project);
        doc.request();
        try {
            SnapshotApi.getResult(
                    snapshotApi.getDoc(Optional.empty(), project));
        } catch (ForbiddenException e) {
            Log.debug("[{}] Auth needed", project);
            getAndInjectCredentials(
                    project,
                    servletRequest,
                    servletResponse,
                    filterChain
            );
            return;
        } catch (MissingRepositoryException e) {
            handleMissingRepository(project, e, (HttpServletResponse) servletResponse);
        }
        Log.debug("[{}] Auth not needed", project);
        filterChain.doFilter(servletRequest, servletResponse);
    }

    // TODO: this is ridiculous. Check for error cases first, then return/throw
    // TODO: also, use an Optional credential, since we treat it as optional
    private void getAndInjectCredentials(
            String projectName,
            ServletRequest servletRequest,
            ServletResponse servletResponse,
            FilterChain filterChain
    ) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;
        String capturedUsername = "(unknown)";

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null) {
            String clientIp = request.getHeader("X-Forwarded-For");
            if (clientIp == null) {
              clientIp = request.getRemoteAddr();
            }
            Log.debug("[{}] Authorization header present", clientIp);
            StringTokenizer st = new StringTokenizer(authHeader);
            if (st.hasMoreTokens()) {
                String basic = st.nextToken();
                if (basic.equalsIgnoreCase("Basic")) {
                    try {
                        String credentials = new String(
                                Base64.decodeBase64(st.nextToken()),
                                "UTF-8"
                        );
                        String[] split = credentials.split(":",2);
                        if (split.length == 2) {
                            String username = split[0];
                            String password = split[1];
                            String accessToken = null;
                            if (username.length() > 0) {
                                capturedUsername = username;
                            }
                            try {
                                accessToken = new PasswordTokenRequest(
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
                            } catch (TokenResponseException e) {
                                handleNeedAuthorization(projectName, capturedUsername, e.getStatusCode(), request, response);
                                return;
                            }
                            final Credential cred = new Credential.Builder(
                                    BearerToken.authorizationHeaderAccessMethod(
                                    )
                            ).build();
                            cred.setAccessToken(accessToken);
                            servletRequest.setAttribute(ATTRIBUTE_KEY, cred);

                            filterChain.doFilter(
                                    servletRequest,
                                    servletResponse
                            );
                        } else {
                            handleNeedAuthorization(projectName, capturedUsername, 0, request, response);
                        }
                    } catch (UnsupportedEncodingException e) {
                        throw new Error("Couldn't retrieve authentication", e);
                    }
                }
            }
        } else {
            handleNeedAuthorization(projectName, capturedUsername, 0, request, response);
        }
    }

    @Override
    public void destroy() {}

    private void handleNeedAuthorization(
            String projectName,
            String userName,
            int statusCode,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) throws IOException {
        Log.info(
            "[{}] Unauthorized, User '{}' status={} ip={}",
            projectName,
            userName,
            statusCode,
            servletRequest.getRemoteAddr()
        );
        HttpServletResponse response = servletResponse;
        response.setContentType("text/plain");
        response.setHeader("WWW-Authenticate", "Basic realm=\"Git Bridge\"");
        PrintWriter w = response.getWriter();
        if (statusCode == 429) {
          // Rate limit
          response.setStatus(429);
          w.println(
            "Rate limit exceeded. Please wait and try again later."
          );
        } else {
          response.setStatus(401);
          w.println(
            "Please sign in using your email address and Overleaf password."
          );
          w.println();
          w.println(
            "*Note*: if you sign in to Overleaf using another provider, "
              + "such "
          );
          w.println(
            "as Google or Twitter, you need to set a password "
              + "on your Overleaf "
          );
          w.println(
            "account first. "
              + "Please see https://www.overleaf.com/blog/195 for "
          );
          w.println("more information.");
        }

        w.close();
    }

    private void handleMissingRepository(
            String projectName,
            MissingRepositoryException e,
            HttpServletResponse response
    ) throws IOException {
        Log.info("[{}] Project missing.", projectName);

        response.setContentType("text/plain");

        // git special-cases 404 to give "repository '%s' not found",
        // rather than displaying the raw status code.
        response.setStatus(404);

        PrintWriter w = response.getWriter();
        for (String line : e.getDescriptionLines()) {
            w.println(line);
        }
        w.close();
    }
}
