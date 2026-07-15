import json
import logging
import typing

import pykka
import tornado.web
from mopidy.core import tracklist
from mopidy.models import TlTrack, Track
from pykka import ThreadingFuture

from mopidy_eboplayer2.Storage import Storage
from mopidy_eboplayer2.webSocketHandler import broadcast_to_websockets

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
        if data_path in ["get_all_streamlines", "get_active_streamlines", "set_album_volume_down", "set_album_volume_up", "get_mopidy_config_file", "add_excluded_file_extension"]:
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

    def get_mopidy_config_file(self):
        with open('/etc/mopidy/mopidy.conf', 'r') as file:
            data = file.read()
            self.write(data)

    def set_album_volume_down(self):
        self.set_album_volume_up_or_down(False)

    def set_album_volume_up(self):
        self.set_album_volume_up_or_down(True)

    def set_album_volume_up_or_down(self, volume_up: bool):
        uri = self.get_argument("uri")
        backend_proxy = self.get_backend_proxy()

        if backend_proxy:
            # Call it asynchronously (returns a Future) to prevent deadlocks
            if volume_up:
                future = backend_proxy.adjust_album_volume_up(uri)
            else:
                future = backend_proxy.adjust_album_volume_down(uri)
            new_volume_adjust = future.get() # Wait for the backend to finish saving
            logger.info(f"Adjusted volume to {new_volume_adjust}")

            current_tl_track = self.core.playback.get_current_tl_track().get()
            logger.info("Getting current track: ")

            if current_tl_track is not None:
                track: Track = current_tl_track.track
                logger.info(f"Now playing (or selected): {track.name}")
                logger.info(f"TLID: {current_tl_track.tlid}")
                #todo: change the volume!!!
                future = backend_proxy.set_volume_from_track(track.uri)
                future.get()
            #todo: broadcast to all clients the affected tracks and their new volume.
            the_event = {
                "event" : "volume_adjust_changed",
                "uri" : uri,
                "volumeAdjust" : new_volume_adjust
            }
            broadcast_to_websockets(json.dumps(the_event))

    def add_excluded_file_extension(self):
        ext = self.get_argument("ext")
        backend_proxy = self.get_backend_proxy()

        if backend_proxy:
            future = backend_proxy.add_excluded_file_extension(ext)
            future.get()

    @staticmethod
    def setup():
        pass

    @staticmethod
    def get_backend_proxy():
        backend_proxies = pykka.ActorRegistry.get_by_class_name("EbobackBackend")
        if backend_proxies:
            return backend_proxies[0].proxy()
        return None

