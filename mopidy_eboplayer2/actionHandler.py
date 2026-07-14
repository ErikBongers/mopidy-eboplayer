import json
import logging
import typing

import pykka
import tornado.web
from mopidy.core import tracklist
from mopidy.models import TlTrack
from pykka import ThreadingFuture

from mopidy_eboplayer2.Storage import Storage

logger = logging.getLogger(__name__)

class ActionHandler(tornado.web.RequestHandler):
    # noinspection PyAttributeOutsideInit
    def initialize(self, config, path, core):
        self.__path = path
        self.config = config
        self.core = core
        self.storage = Storage(self.config['eboplayer2']['storage_dir'], core)

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*") #todo: use allowed origins from config.
        self.set_header("Access-Control-Allow-Headers", "x-requested-with")
        self.set_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.set_header("Cache-Control", "no-cache, no-store, must-revalidate")

    def get(self, data_path: str):
        if data_path in ["get_all_streamlines", "get_active_streamlines", "set_album_volume_down", "set_album_volume_up"]:
            func = getattr(self, data_path)
            func()
            return

    def get_all_streamlines(self):
        uri = self.get_argument("uri")
        self.storage.set_stream_uri(uri)
        self.write(json.dumps(self.storage.get_all_titles()))

    def get_active_streamlines(self):
        uri = self.get_argument("uri")
        self.storage.set_stream_uri(uri)
        self.write(json.dumps(self.storage.get_active_titles_object(self.storage.get_all_titles())))

    def set_album_volume_down(self):
        uri = self.get_argument("uri")
        self.storage.set_album_volume_down(uri)

        backend_proxy = self.get_backend_proxy()

        if backend_proxy:
            # Call it asynchronously (returns a Future) to prevent deadlocks
            future = backend_proxy.adjust_album_volume_down(uri)
            future.get() # Wait for the backend to finish saving

            current_tl_track = self.core.playback.get_current_tl_track().get()
            logger.info("Getting current track: ")

            if current_tl_track is not None:
                track = current_tl_track.track
                logger.info(f"Now playing: {track.name} by {track.artists[0].name}")
                logger.info(f"TLID: {current_tl_track.tlid}")
            #todo: broadcast to all clients the affected tracks and their new volume.

    @staticmethod
    def setup():
        pass

    @staticmethod
    def get_backend_proxy():
        backend_proxies = pykka.ActorRegistry.get_by_class_name("EbobackBackend")
        if backend_proxies:
            return backend_proxies[0].proxy()
        return None

