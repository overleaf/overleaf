package uk.ac.ic.wlgitbridge.application;

import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.ResourceHandler;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Created by Winston on 04/12/14.
 */
public class AttsResourceHandler extends ResourceHandler {

    @Override
    public void handle(String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
        System.out.println(baseRequest);
        super.handle(target, baseRequest, request, response);
    }

}
