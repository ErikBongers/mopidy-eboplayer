import pathlib

import pkg_resources

from mopidy import config, ext

__version__ = pkg_resources.get_distribution(
    "Mopidy-Eboplayer"
).version


class Extension(ext.Extension):

    dist_name = "Mopidy-Eboplayer"
    ext_name = "eboplayer"
    version = __version__

    def get_default_config(self):
        return config.read(pathlib.Path(__file__).parent / "ext.conf")

    def get_config_schema(self):
        schema = super().get_config_schema()
        schema["websocket_host"] = config.Hostname(optional=True)
        schema["websocket_port"] = config.Port(optional=True)
        schema["on_track_click"] = config.String(
            optional=True,
            choices=[
                "PLAY_NOW",
                "PLAY_NEXT",
                "ADD_THIS_BOTTOM",
                "ADD_ALL_BOTTOM",
                "PLAY_ALL",
                "DYNAMIC",
            ],
        )
        return schema

    def setup(self, registry):
        # Ebo: added this call to setup to make the directory for the streamLines.txt file.
        from .streamlineshandler import ActiveStreamLinesHandler
        ActiveStreamLinesHandler.setup()

        from .frontend import EboPlayerFrontend
        registry.add("http:app", {"name": self.ext_name, "factory": self.factory})
        registry.add("frontend", EboPlayerFrontend)

    def factory(self, config, core): # factory is a Python function used by a Mopidy extension to register a web application with the Mopidy HTTP server.
        from tornado.web import RedirectHandler
        from .web import IndexHandler, StaticHandler
        from .streamlineshandler import ActiveStreamLinesHandler

        path = pathlib.Path(__file__).parent / "static"
        return [
            (r"/", RedirectHandler, {"url": "index.html"}),
            (r"/(index.html)", IndexHandler, {"config": config, "path": path}),
            (r"/stream/activeLines(/all)?", ActiveStreamLinesHandler, {"config": config, "path": path}),
            (r"/(.*)", StaticHandler, {"path": path}),
        ]
