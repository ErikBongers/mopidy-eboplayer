import json
import logging
import tornado.web

from mopidy_eboplayer2.Storage import Storage

logger = logging.getLogger(__name__)

class ActionHandler(tornado.web.RequestHandler):
    # noinspection PyAttributeOutsideInit
    def initialize(self, config, path, core):
        self.__path = path
        self.config = config
        self.core = core
        self.storage = Storage(self.config['eboplayer2']['storage_dir'], core)

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*") #todo: use allowed origins from config.
        self.set_header("Access-Control-Allow-Headers", "x-requested-with")
        self.set_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.set_header("Cache-Control", "no-cache, no-store, must-revalidate")

    def get(self, data_path: str):
        if data_path in ["get_all_streamlines", "get_active_streamlines"]:
            func = getattr(self, data_path)
            func()
            return

    def get_all_streamlines(self):
        uri = self.get_argument("uri")
        self.storage.set_stream_uri(uri)
        self.write(json.dumps(self.storage.get_all_titles()))

    def get_active_streamlines(self):
        uri = self.get_argument("uri")
        self.storage.set_stream_uri(uri)
        self.write(json.dumps(self.storage.get_active_titles_object(self.storage.get_all_titles())))

    @staticmethod
    def setup():
        pass
