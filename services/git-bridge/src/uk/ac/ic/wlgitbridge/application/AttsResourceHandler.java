package uk.ac.ic.wlgitbridge.application;

import org.eclipse.jetty.http.HttpURI;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.util.MultiMap;
import uk.ac.ic.wlgitbridge.writelatex.WriteLatexAPI;

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
        HttpURI uri = baseRequest.getUri();
        System.out.println(baseRequest.getMethod() + " " + uri);
        System.out.println(uri.getPath());
        MultiMap<String> multimap = new MultiMap<String>();
        uri.decodeQueryTo(multimap);
        System.out.println(multimap);

        if (false) {
            throw new ServletException();
        }
        super.handle(target, baseRequest, request, response);
    }

}
