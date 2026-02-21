import os
import logging
import json
from pathlib import Path

from mopidy_eboplayer2.tools import url_to_filename, tail

logger = logging.getLogger(__name__)

# STORAGE_DIR = '/var/lib/eboplayer'
# STREAM_LINES_DIR = r'C:\Tmp'
# STREAM_TITLES_FILE = STORAGE_DIR + '/streamLines.txt'
# STATE_FILE = STORAGE_DIR + '/state.json'
SEPARATOR_LINE = "---"

class Storage:
    def __init__(self, storage_dir):
        self.storage_dir = storage_dir
        self.stateFile = self.storage_dir + '/state.json'
        self.streamTitlesFile = ""
        self.current_track_uri = ""

    def setup(self):
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir)

    def get_all_titles(self):
        logger.info(f"streamTitlesFile: {self.streamTitlesFile}")
        if self.streamTitlesFile == "":
            return []

        lines = []
        with open(self.streamTitlesFile, 'rb+') as file:
            lines = tail(file, 100)
        return lines

    def get_active_titles_object(self, titles = None):
        active_titles = self.get_active_titles(titles)
        stream_titles = {
            "uri": self.current_track_uri,
            "active_titles": active_titles
        }
        return stream_titles

    def get_active_titles(self, titles = None):
        if titles is None:
            titles = self.get_all_titles()
        active_titles = []
        iterator = titles
        # ignore the final separator line, if any.
        if iterator:
            if iterator[-1] == SEPARATOR_LINE:
                iterator = titles[:-1]

        for title in reversed(iterator):
            if title == SEPARATOR_LINE:
                break
            active_titles.insert(0, title)
        return active_titles

    def write_title(self, title) -> bool:
        all_titles = self.get_all_titles()
        active_titles = self.get_active_titles(all_titles)
        if title in active_titles:
            # write a separator line, if not yet present
            if all_titles[-1] != SEPARATOR_LINE:
                with open(self.streamTitlesFile, 'a+') as the_file:
                    the_file.write(SEPARATOR_LINE + '\n')

            return False # no title written.

        with open(self.streamTitlesFile, 'a+') as the_file:
            the_file.write(title + '\n')

        return True # line written

    def add_empty_title(self):
        # an empty title means 2 separator lines
        all_titles = self.get_all_titles()
        line_count = len(all_titles)
        if line_count == 0:
            return
        if line_count >= 2 and all_titles[-1] == SEPARATOR_LINE and all_titles[-2] == SEPARATOR_LINE:
            return # already 2 separators.

        with open(self.streamTitlesFile, 'a+') as the_file:
            if line_count >= 1 and all_titles[-1] != SEPARATOR_LINE:
                # not even a single separator line
                the_file.write(SEPARATOR_LINE + '\n')
            the_file.write(SEPARATOR_LINE + '\n')

    def get_state(self):
        try:
            with open(self.stateFile, 'r+') as f:
                state = json.load(f)
            return state
        except IOError:
            return {}

    def get(self, key, default):
        state = self.get_state()
        if key in state:
            return state[key]
        return default

    def save(self, key, value):
        state = self.get_state()
        state[key] = value
        with open(self.stateFile, 'w+') as f:
            json.dump(state, f)

    def switch_stream_uri(self, uri):
        logger.info(f"switch_stream_uri: {uri}")
        if self.current_track_uri == "":
            return
        if not self.current_track_uri.startswith("eboback:stream:"):
            return

        self.add_empty_title()
        self.set_stream_uri(uri)
        self.add_empty_title()

    def set_stream_uri(self, uri):
        self.current_track_uri = uri
        self.streamTitlesFile = uri
        self.streamTitlesFile = self.streamTitlesFile.replace("http://", "")
        self.streamTitlesFile = url_to_filename(self.streamTitlesFile)
        self.streamTitlesFile = self.storage_dir + "/" + self.streamTitlesFile + ".txt"
        logger.info(self.streamTitlesFile)
        Path(self.streamTitlesFile, exist_ok=True).touch()
