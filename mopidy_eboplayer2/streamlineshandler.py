import json
import logging
import tornado.web

from mopidy_eboplayer2.Storage import Storage

logger = logging.getLogger(__name__)

class ActiveStreamLinesHandler(tornado.web.RequestHandler):
    # noinspection PyAttributeOutsideInit
    def initialize(self, config, path):
        self.__path = path
        self.config = config
        self.storage = Storage(self.config['eboplayer2']['storage_dir'])

    def get(self, all):
        self.set_header("Access-Control-Allow-Origin", "*")
        uri = self.get_argument("uri")
        self.storage.set_stream_uri(uri)
        if all == "/all":
            return self.write(json.dumps(self.storage.get_all_titles()))
        else:
            return self.write(json.dumps(self.storage.get_active_titles_dict(self.storage.get_all_titles())))

    @staticmethod
    def setup():
        pass
