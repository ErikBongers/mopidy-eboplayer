def url_to_filename(txt):
    txt = txt.replace(".", "_")
    txt = txt.replace("/", "_")
    txt = txt.replace("\\", "_")
    txt = txt.replace("-", "_")
    txt = txt.replace("~", "_")
    txt = txt.replace(":", "_")
    txt = txt.replace("/", "_")
    txt = txt.replace("?", "_")
    txt = txt.replace("#", "_")
    txt = txt.replace("[", "_")
    txt = txt.replace("]", "_")
    txt = txt.replace("@", "_")
    txt = txt.replace("!", "_")
    txt = txt.replace("$", "_")
    txt = txt.replace("&", "_")
    txt = txt.replace("(", "_")
    txt = txt.replace(")", "_")
    txt = txt.replace("*", "_")
    txt = txt.replace("+", "_")
    txt = txt.replace("'", "_")
    txt = txt.replace(";", "_")
    txt = txt.replace("%", "_")
    txt = txt.replace("=", "_")
    return txt


def tail(f, lines=20):
    """ file must be opened binary! """
    total_lines_wanted = lines

    BLOCK_SIZE = 1024
    f.seek(0, 2)
    block_end_byte = f.tell()
    lines_to_go = total_lines_wanted
    block_number = -1
    blocks = []
    while lines_to_go > 0 and block_end_byte > 0:
        if (block_end_byte - BLOCK_SIZE > 0):
            f.seek(block_number * BLOCK_SIZE, 2)
            blocks.append(f.read(BLOCK_SIZE))
        else:
            f.seek(0, 0)
            blocks.append(f.read(block_end_byte))
        lines_found = blocks[-1].count(b'\n')
        lines_to_go -= lines_found
        block_end_byte -= BLOCK_SIZE
        block_number -= 1
    all_read_text = b''.join(reversed(blocks))
    byte_lines = all_read_text.splitlines()[-total_lines_wanted:]
    return [byte_line.decode('utf-8') for byte_line in byte_lines]
