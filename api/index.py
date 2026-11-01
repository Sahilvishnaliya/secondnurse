import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app as _flask_app  # noqa: E402


def _restore_original_path(environ):
    """Vercel rewrites /api/<route> to this function; recover the original path."""
    uri = (environ.get("REQUEST_URI") or "").split("?")[0]
    path = environ.get("PATH_INFO") or ""
    if uri.startswith("/api/") and not uri.startswith("/api/index.py"):
        environ["PATH_INFO"] = uri
    elif path.startswith("/api/index.py/"):
        environ["PATH_INFO"] = "/api/" + path[len("/api/index.py/"):]


class _PathMiddleware:
    def __init__(self, wsgi):
        self.wsgi = wsgi

    def __call__(self, environ, start_response):
        _restore_original_path(environ)
        return self.wsgi(environ, start_response)


app = _PathMiddleware(_flask_app.wsgi_app)
