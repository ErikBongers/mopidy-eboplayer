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
        self.current_track_uri = ""

    def on_start(self) -> None:
        logger.info("STARTING....")
        volume = self.storage.get('volume', 50)
        self.core.mixer.set_volume(volume)

    def track_playback_started(self, tl_track):
        logger.info("STARTED !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        logger.info(tl_track.track.uri)
        self.current_track_uri = tl_track.track.uri
        self.storage.set_stream_uri(self.current_track_uri)


    def track_playback_ended(self, tl_track, time_position):
        self.on_track_ended()

    def track_playback_paused(self, tl_track, time_position):
        self.on_track_ended()

    def stream_title_changed(self, title: str) -> None:
        if self.storage.write_title(title):
            stream_titles = self.storage.get_active_titles_dict()
            self.send('stream_history_changed2', data=stream_titles)

    def volume_changed(self, volume):
        self.storage.save('volume', volume)

    def stream_history_changed2(self, data):
        pass

    def stream_history_changed(self, data):
        pass

    def tracklist_changed(self):
        self.on_track_ended()

    def playback_state_changed(self, old_state, new_state):
        pass
        # if new_state == 'stopped':
        #     self.on_track_ended()

    def on_track_ended(self):
        self.current_track_uri = ""
        self.storage.set_stream_uri(self.current_track_uri)
