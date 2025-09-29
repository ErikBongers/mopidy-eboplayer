import json
import logging
import socket
import string
import os
import tornado.web

logger = logging.getLogger(__name__)

STREAM_LINES_DIR = '/var/lib/eboplayer'
STREAM_LINES_FILE = '/var/lib/eboplayer/streamLines.txt'

class ActiveStreamLinesHandler(tornado.web.RequestHandler):
    def initialize(self, config, path):
        self.__path = path

    def get(self):
        return self.write(json.dumps(get_active_lines(get_all_lines())))

    def post(self):
        self.write_line(self.get_body_argument("line"))
        return self.write(json.dumps(get_active_lines(get_all_lines())))

    @staticmethod
    def setup():
        if not os.path.exists(STREAM_LINES_DIR):
            os.makedirs(STREAM_LINES_DIR)

    @staticmethod
    def write_line(line):
        all_lines = get_all_lines()
        active_lines = get_active_lines(all_lines)
        if line in active_lines:
            # write a separator line, if not yet present
            if all_lines[-1] != SEPARATOR_LINE:
                with open(STREAM_LINES_FILE, 'a+') as the_file:
                    the_file.write(SEPARATOR_LINE + '\n')

            return

        with open(STREAM_LINES_FILE, 'a+') as the_file:
            the_file.write(line + '\n')

def get_all_lines():
    lines = []
    with open(STREAM_LINES_FILE, 'r+') as file:
        for line in file:
            lines.append(line.rstrip('\n'))
    return lines

SEPARATOR_LINE = "---"

def get_active_lines(lines):
    lines = get_all_lines()
    active_lines = []

    # ignore the final separator line, if any.
    if lines:
        if lines[-1] == SEPARATOR_LINE:
            lines.pop()

    for line in reversed(lines):
        if line == SEPARATOR_LINE:
            break
        active_lines.insert(0, line)
    return active_lines
