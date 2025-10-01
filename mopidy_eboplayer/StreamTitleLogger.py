import os
import logging

logger = logging.getLogger(__name__)

STREAM_LINES_DIR = '/var/lib/eboplayer'
# STREAM_LINES_DIR = r'C:\Tmp'
STREAM_LINES_FILE = STREAM_LINES_DIR+'/streamLines.txt'

def setup():
    if not os.path.exists(STREAM_LINES_DIR):
        os.makedirs(STREAM_LINES_DIR)

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

