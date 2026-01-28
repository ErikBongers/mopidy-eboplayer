import pathlib
import pkg_resources

from mopidy import config, ext

__version__ = pkg_resources.get_distribution(
    "Mopidy-Eboplayer2"
).version


class Extension(ext.Extension):

    dist_name = "Mopidy-Eboplayer2"
    ext_name = "eboplayer2"
    version = __version__

    def get_default_config(self):
        conf = config.read(pathlib.Path(__file__).parent / "ext.conf")
        return conf

    def get_config_schema(self):
        schema = super().get_config_schema()
        schema["websocket_host"] = config.Hostname(optional=True)
        schema["websocket_port"] = config.Port(optional=True)
        schema["storage_dir"] = config.String(optional=False)
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
        from .frontend import EboPlayerFrontend
        registry.add("http:app", {"name": self.ext_name, "factory": self.factory})
        registry.add("frontend", EboPlayerFrontend)

    def factory(self, config, core): # factory is a Python function used by a Mopidy extension to register a web application with the Mopidy HTTP server.
        from tornado.web import RedirectHandler
        from .web import IndexHandler, StaticHandler
        from .streamlineshandler import ActiveStreamLinesHandler
        from .webSocketHandler import EboWebsocketHandler

        path = pathlib.Path(__file__).parent / "www"
        return [
            (r"/", RedirectHandler, {"url": "index.html"}),
            (r"/(index.html)", IndexHandler, {"config": config, "path": path}),
            (r"/stream/(active|all)Lines", ActiveStreamLinesHandler, {"config": config, "path": path}),
            (r"/ws/?", EboWebsocketHandler, {"config": config}),  #Why this pattern??? I know it's in mopidy http somewhere, but still...
            (r"/(.*)", StaticHandler, {"path": path}),
        ]
