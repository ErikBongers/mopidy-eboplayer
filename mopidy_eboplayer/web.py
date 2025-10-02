import json
import logging
import socket
import string
import urllib.parse

import tornado.web

import mopidy_eboplayer.webclient as mmw

logger = logging.getLogger(__name__)


class StaticHandler(tornado.web.StaticFileHandler):
    def get(self, path, *args, **kwargs):
        version = self.get_argument("v", None)
        if version:
            logger.debug("Get static resource for %s?v=%s", path, version)
        else:
            logger.debug("Get static resource for %s", path)
        return super().get(path, *args, **kwargs)

    # todo: remove in production!
    def set_extra_headers(self, path):
        # Disable cache
        self.set_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')

    @classmethod
    def get_version(cls, settings, path):
        return mmw.Extension.version


class IndexHandler(tornado.web.RequestHandler):
    def initialize(self, config, path):

        webclient = mmw.Webclient(config)

        url = urllib.parse.urlparse(
            f"{self.request.protocol}://{self.request.host}"
        )
        port = url.port or 80
        try:
            ip = socket.getaddrinfo(url.hostname, port)[0][4][0]
        except Exception:
            ip = url.hostname

        # Values sent to Tornado renderer.
        self.__dict = {
            "websocketUrl": webclient.get_websocket_url(self.request),
            "onTrackClick": webclient.get_default_click_action(),
            "hostname": url.hostname,
            "serverIP": ip,
            "serverPort": port,
        }
        self.__path = path
        self.__title = string.Template("Mopidy on $hostname")

    def get(self, path):
        logger.info("get: CACHE OFF")
        self.set_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        return self.render(path, title=self.get_title(), **self.__dict)

    def get_title(self):
        url = urllib.parse.urlparse(
            f"{self.request.protocol}://{self.request.host}"
        )
        return self.__title.safe_substitute(hostname=url.hostname)

    def get_template_path(self):
        return self.__path

    # todo: remove in production!
    def set_extra_headers(self, path):
        logger.info("CACHE OFF")
        # Disable cache
        self.set_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')

