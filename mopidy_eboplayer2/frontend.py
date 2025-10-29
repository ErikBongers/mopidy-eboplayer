import logging
import pykka
from mopidy import core

from mopidy_eboplayer2.Storage import Storage

logger = logging.getLogger(__name__)


class EboPlayerFrontend(pykka.ThreadingActor, core.CoreListener):
    def __init__(self, config, core) -> None:
        super(EboPlayerFrontend, self).__init__(config, core)
        self.core = core
        self.config = config
        self.storage = Storage(self.config['eboplayer2']['storage_dir'])
        self.storage.setup()

    def on_start(self) -> None:
        logger.info("STARTING....")

        volume = self.storage.get('volume', 50)
        self.core.mixer.set_volume(volume)
        self.storage.add_empty_title()

    def stream_title_changed(self, title: str) -> None:
        logger.info(f"Stream title: {title}")
        if self.storage.write_title(title):
            lines = self.storage.get_active_titles()
            lines_dict = {index: value for index, value in enumerate(lines)}
            self.send('stream_history_changed', data=lines_dict)

    def volume_changed(self, volume):
        logger.info("Volume changed. Saving to settings file.")
        self.storage.save('volume', volume)

    def stream_history_changed(self, data):
        pass

    def tracklist_changed(self):
        self.storage.add_empty_title()

    def playback_state_changed(self, old_state, new_state):
        self.storage.add_empty_title()
