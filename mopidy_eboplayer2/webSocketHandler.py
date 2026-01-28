import tornado.websocket
import logging

logger = logging.getLogger(__name__)


def broadcast_to_websockets(message: str):
    for websocket_handler in socket_handlers_to_broadcast_to:
        websocket_handler.ioloop.add_callback(EboWebsocketHandler.write_message, websocket_handler, message)

class EboWebsocketHandler(tornado.websocket.WebSocketHandler):

    def initialize(self, config):
        self.config = config
        self.ioloop = tornado.ioloop.IOLoop.current()

    def check_origin(self, origin):
        return True #allows cross-domain requests

    def open(self):
        socket_handlers_to_broadcast_to.add(self)

    def on_message(self, message):
        logger.info("eboplayer websocket message received: " + message)

    def on_close(self):
        socket_handlers_to_broadcast_to.remove(self)


socket_handlers_to_broadcast_to: set[EboWebsocketHandler] = set()
