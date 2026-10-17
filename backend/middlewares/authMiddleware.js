const AuthService = require('../services/authService');

/**
 * Standard HTTP Basic Authentication Middleware (RFC 7617).
 * Intercepts requests, validates Authorization: Basic <base64>, and attaches req.user.
 */
async function basicAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="DynaSched System"');
    return res.status(401).json({
      error: 'Authentication required. Please provide HTTP Basic Auth credentials.'
    });
  }

  const credentials = AuthService.parseBasicAuthHeader(authHeader);
  if (!credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="DynaSched System"');
    return res.status(401).json({
      error: 'Malformed Basic Authentication header.'
    });
  }

  const { authenticated, user, error } = await AuthService.verifyCredentials(
    credentials.username,
    credentials.password
  );

  if (!authenticated) {
    res.setHeader('WWW-Authenticate', 'Basic realm="DynaSched System"');
    return res.status(401).json({
      error: error || 'Invalid username or password.'
    });
  }

  // Attach authenticated user to request context
  req.user = user;
  next();
}

module.exports = basicAuthMiddleware;
