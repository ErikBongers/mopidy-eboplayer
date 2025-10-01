import logging
import pykka
from mopidy import core
from .StreamTitleLogger import write_line

logger = logging.getLogger(__name__)

class EboPlayerFrontend(pykka.ThreadingActor, core.CoreListener):
    def __init__(self, config, core) -> None:
        super(EboPlayerFrontend, self).__init__(config, core)
        self.core = core

    def on_start(self) -> None:
        return None

    def stream_title_changed(self, title: str) -> None:
        logger.info(f"Stream title: {title}")
        if write_line(title):
            self.send('stream_history_changed', data={
                'event': 'stream_history_changed',
                'data': 'todo?'
            })

    def stream_history_changed(self, data): #todo: this function needed?
        pass
