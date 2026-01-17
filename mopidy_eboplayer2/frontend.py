import logging
import pykka
import json
from mopidy import core
import urllib.request
from mopidy_eboplayer2.Storage import Storage
from mopidy_eboplayer2.webSocketHandler import broadcast

logger = logging.getLogger(__name__)


class EboPlayerFrontend(pykka.ThreadingActor, core.CoreListener):
    def __init__(self, config, core) -> None:
        super(EboPlayerFrontend, self).__init__(config, core)
        self.core = core
        self.config = config
        self.storage = Storage(self.config['eboplayer2']['storage_dir'])
        self.host = self.config['http']['hostname']
        self.port = self.config['http']['port']
        self.storage.setup()
        self.current_track_uri = ""
        self.current_excluded_streamlines = []

    def on_start(self) -> None:
        logger.info("STARTING....")
        volume = self.storage.get('volume', 50)
        self.core.mixer.set_volume(volume)

    def track_playback_started(self, tl_track):
        self.current_track_uri = tl_track.track.uri
        self.storage.switch_stream_uri(self.current_track_uri)
        contents = urllib.request.urlopen(f"http://{self.host}:{self.port}/eboback/data/get_excluded_streamlines?uri={self.current_track_uri}").read()
        self.current_excluded_streamlines = contents.decode("utf-8").split("\n")
        logger.info("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"+str(self.current_excluded_streamlines))


    def track_playback_ended(self, tl_track, time_position):
        self.on_track_ended()

    def track_playback_paused(self, tl_track, time_position):
        self.on_track_ended()

    def get_current_uri(self):
        if self.current_track_uri == "":
            tl_track = self.core.playback.get_current_tl_track
            if tl_track is None:
                return
            self.current_track_uri = tl_track.track.uri

    def stream_title_changed(self, title: str) -> None:
        if title in self.current_excluded_streamlines:
            return
        if self.storage.write_title(title):
            stream_titles = self.storage.get_active_titles_object()
            the_event = {
                "event" : "stream_history_changed",
                "stream_titles" : stream_titles
            }
            broadcast(json.dumps(the_event))

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
        self.storage.switch_stream_uri(self.current_track_uri)
