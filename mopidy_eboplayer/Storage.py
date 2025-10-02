import os
import logging
import json

logger = logging.getLogger(__name__)

STORAGE_DIR = '/var/lib/eboplayer'
# STREAM_LINES_DIR = r'C:\Tmp'
STREAM_LINES_FILE = STORAGE_DIR + '/streamLines.txt'
STATE_FILE = STORAGE_DIR + '/state.json'

def setup():
    if not os.path.exists(STORAGE_DIR):
        os.makedirs(STORAGE_DIR)

def get_all_lines():
    lines = []
    with open(STREAM_LINES_FILE, 'r+') as file:
        for line in file:
            lines.append(line.rstrip('\n'))
    return lines

SEPARATOR_LINE = "---"

def get_active_lines(lines):
    active_lines = []
    iterator = lines
    # ignore the final separator line, if any.
    if iterator:
        if iterator[-1] == SEPARATOR_LINE:
            iterator = lines[:-1]

    for line in reversed(iterator):
        if line == SEPARATOR_LINE:
            break
        active_lines.insert(0, line)
    return active_lines

def write_line(line) -> bool:
    all_lines = get_all_lines()
    active_lines = get_active_lines(all_lines)
    if line in active_lines:
        # write a separator line, if not yet present
        if all_lines[-1] != SEPARATOR_LINE:
            with open(STREAM_LINES_FILE, 'a+') as the_file:
                the_file.write(SEPARATOR_LINE + '\n')

        return False # no line written.

    with open(STREAM_LINES_FILE, 'a+') as the_file:
        the_file.write(line + '\n')

    return True # line written

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
