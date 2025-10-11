import os
import logging
import json

logger = logging.getLogger(__name__)

STORAGE_DIR = '/var/lib/eboplayer'
# STREAM_LINES_DIR = r'C:\Tmp'
STREAM_TITLES_FILE = STORAGE_DIR + '/streamLines.txt'
STATE_FILE = STORAGE_DIR + '/state.json'

def setup():
    if not os.path.exists(STORAGE_DIR):
        os.makedirs(STORAGE_DIR)

def get_all_titles():
    lines = []
    with open(STREAM_TITLES_FILE, 'r+') as file:
        for line in file:
            lines.append(line.rstrip('\n'))
    return lines

SEPARATOR_LINE = "---"

def get_active_titles(titles = None):
    if titles is None:
        titles = get_all_titles()
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

def write_title(title) -> bool:
    all_titles = get_all_titles()
    active_titles = get_active_titles(all_titles)
    if title in active_titles:
        # write a separator line, if not yet present
        if all_titles[-1] != SEPARATOR_LINE:
            with open(STREAM_TITLES_FILE, 'a+') as the_file:
                the_file.write(SEPARATOR_LINE + '\n')

        return False # no title written.

    with open(STREAM_TITLES_FILE, 'a+') as the_file:
        the_file.write(title + '\n')

    return True # line written

def add_empty_title():
    # an empty title means 2 separator lines
    all_titles = get_all_titles()
    line_count = len(all_titles)
    if line_count == 0:
        return
    if line_count >= 2 and all_titles[-1] == SEPARATOR_LINE and all_titles[-2] == SEPARATOR_LINE:
        return # already 2 separators.

    with open(STREAM_TITLES_FILE, 'a+') as the_file:
        if line_count >= 1 and all_titles[-1] != SEPARATOR_LINE:
            # not even a single separator line
            the_file.write(SEPARATOR_LINE + '\n')
        the_file.write(SEPARATOR_LINE + '\n')

def get_state():
    try:
        with open(STATE_FILE, 'r+') as f:
            state = json.load(f)
        return state
    except IOError:
        return {}

def get(key, default):
    state = get_state()
    if key in state:
        return state[key]
    return default

def save(key, value):
    state = get_state()
    state[key] = value
    with open(STATE_FILE, 'w+') as f:
        json.dump(state, f)
