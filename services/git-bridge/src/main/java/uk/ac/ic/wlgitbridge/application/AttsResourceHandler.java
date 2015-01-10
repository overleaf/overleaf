package uk.ac.ic.wlgitbridge.application;

import org.eclipse.jetty.http.HttpURI;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.util.MultiMap;
import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.WriteLatexAPI;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.InvalidPostbackKeyException;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Created by Winston on 04/12/14.
 */
public class AttsResourceHandler extends ResourceHandler {

    private final WriteLatexAPI writeLatexDataSource;

    public AttsResourceHandler(WriteLatexAPI writeLatexDataSource) {
        this.writeLatexDataSource = writeLatexDataSource;
    }

    @Override
    public void handle(String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
        String method = baseRequest.getMethod();
        if (method.equals("GET")) {
            HttpURI uri = baseRequest.getUri();
            Util.sout(method + " " + uri);
            MultiMap<String> multimap = new MultiMap<String>();
            uri.decodeQueryTo(multimap);
            String[] pathSections = uri.getPath().split("/");
            String key = multimap.getString("key");
            if (key == null || pathSections.length < 2) {
                throw new ServletException();
            }
            try {
                writeLatexDataSource.checkPostbackKey(pathSections[1], key);
            } catch (InvalidPostbackKeyException e) {
                throw new ServletException();
            }
            super.handle(target, baseRequest, request, response);
        }
    }

}
