import json
import logging
import socket
import string
import tornado.web
from .StreamTitleLogger import write_line, get_all_lines, get_active_lines, setup

logger = logging.getLogger(__name__)

class ActiveStreamLinesHandler(tornado.web.RequestHandler):
    def initialize(self, config, path):
        self.__path = path

    def get(self, all):
        if all == "/all":
            return self.write(json.dumps(get_all_lines()))
        else:
            return self.write(json.dumps(get_active_lines(get_all_lines())))

    @staticmethod
    def setup():
        setup()
