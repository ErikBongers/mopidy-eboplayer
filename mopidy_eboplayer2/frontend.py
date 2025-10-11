import logging
import pykka
from mopidy import core

from . import Storage

logger = logging.getLogger(__name__)


class EboPlayerFrontend(pykka.ThreadingActor, core.CoreListener):
    def __init__(self, config, core) -> None:
        super(EboPlayerFrontend, self).__init__(config, core)
        self.core = core

    def on_start(self) -> None:
        logger.info("STARTING....")
        volume = Storage.get('volume', 50)
        self.core.mixer.set_volume(volume)
        Storage.add_empty_title()
        return None

    def stream_title_changed(self, title: str) -> None:
        logger.info(f"Stream title: {title}")
        if Storage.write_title(title):
            lines = Storage.get_active_titles()
            lines_dict = {index: value for index, value in enumerate(lines)}
            self.send('stream_history_changed', data=lines_dict)

    @staticmethod
    def volume_changed(volume):
        logger.info("Volume changed. Saving to settings file.")
        Storage.save('volume', volume)

    def stream_history_changed(self, data): #todo: this function needed?
        pass
