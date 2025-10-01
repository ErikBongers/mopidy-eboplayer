import logging
import pykka
from mopidy.core import CoreListener

logger = logging.getLogger(__name__)

class EboPlayerFrontend(pykka.ThreadingActor, CoreListener):
    def __init__(self, config, core) -> None:
        super().__init__()
        self.config = config
        self.core = core
        self.title_history = []
        self.max_titles = 10  # Or whatever number you want

    def on_start(self) -> None:
        return None

    def stream_title_changed(self, title: str) -> None:
        self.title_history.append(title)
        if len(self.title_history) > self.max_titles:
            self.title_history.pop(0)  # Maintain a max size

        # Optionally log
        logger.info(f"New stream title: {title}")

        # Broadcast to frontend
        self.send_to_frontend()


    def send_to_frontend(self):
        data = {
            'event': 'stream_history_updated',
            'titles': self.title_history,
        }

        CoreListener.send("stream_history_updated", title=data)

    def stream_history_updated(self, title):
        pass
