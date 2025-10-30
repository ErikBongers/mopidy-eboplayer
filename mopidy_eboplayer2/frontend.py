import logging
import pykka
from mopidy import core

from mopidy_eboplayer2.Storage import Storage
from mopidy_eboplayer2.tools import url_to_filename

logger = logging.getLogger(__name__)


class EboPlayerFrontend(pykka.ThreadingActor, core.CoreListener):
    def __init__(self, config, core) -> None:
        super(EboPlayerFrontend, self).__init__(config, core)
        self.core = core
        self.config = config
        self.storage = Storage(self.config['eboplayer2']['storage_dir'])
        self.storage.setup()
        self.current_track_file_name = ""

    def on_start(self) -> None:
        logger.info("STARTING....")
        volume = self.storage.get('volume', 50)
        self.core.mixer.set_volume(volume)

    def track_playback_started(self, tl_track):
        logger.info(tl_track.track.uri)
        self.current_track_file_name = tl_track.track.uri
        self.current_track_file_name = self.current_track_file_name.replace("http://", "")
        self.current_track_file_name = url_to_filename(self.current_track_file_name)
        self.current_track_file_name += ".txt"
        logger.info(self.current_track_file_name)
        self.storage.set_stream_file_name(self.current_track_file_name)


    def track_playback_ended(self, tl_track, time_position):
        self.on_track_ended()

    def track_playback_paused(self, tl_track, time_position):
        self.on_track_ended()

    def stream_title_changed(self, title: str) -> None:
        if self.storage.write_title(title):
            lines = self.storage.get_active_titles()
            lines_dict = {index: value for index, value in enumerate(lines)}
            self.send('stream_history_changed2', data=lines_dict)

    def volume_changed(self, volume):
        self.storage.save('volume', volume)

    def stream_history_changed2(self, data):
        pass

    def stream_history_changed(self, data):
        pass

    def tracklist_changed(self):
        self.on_track_ended()

    def playback_state_changed(self, old_state, new_state):
        if new_state == 'stopped':
            self.on_track_ended()

    def on_track_ended(self):
        self.current_track_file_name = ""
        self.storage.set_stream_file_name(self.current_track_file_name)
