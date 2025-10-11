import json
import logging
import socket
import string
import tornado.web
from .Storage import write_title, get_all_titles, get_active_titles, setup

logger = logging.getLogger(__name__)

class ActiveStreamLinesHandler(tornado.web.RequestHandler):
    def initialize(self, config, path):
        self.__path = path

    def get(self, all):
        self.set_header("Access-Control-Allow-Origin", "*")
        if all == "/all":
            return self.write(json.dumps(get_all_titles()))
        else:
            return self.write(json.dumps(get_active_titles(get_all_titles())))

    @staticmethod
    def setup():
        setup()
