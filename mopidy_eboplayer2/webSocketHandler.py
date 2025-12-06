import tornado.websocket
import logging

logger = logging.getLogger(__name__)
active_clients = set() #todo: make class variable.


def broadcast(message):
    logger.info("Broadcasting message: " + message)
    logger.info("clients: " + str(len(active_clients)))
    for client in active_clients:
        client.ioloop.add_callback(WebsocketHandler.write_message, client, message)

class WebsocketHandler(tornado.websocket.WebSocketHandler):

    def initialize(self, config):
        logger.info("eboplayer initialize websocket")
        self.config = config
        self.ioloop = tornado.ioloop.IOLoop.current()

    def check_origin(self, origin):
        logger.info("eboplayer  checking origin...")
        return True #allows cross-domain requests

    def open(self):
        logger.info("eboplayer new websocket connection opened xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        active_clients.add(self)

    def on_message(self, message):
        logger.info("eboplayer websocket message received: " + message)

    def on_close(self):
        logger.info("eboplayer websocket connection closed")
        active_clients.remove(self)

