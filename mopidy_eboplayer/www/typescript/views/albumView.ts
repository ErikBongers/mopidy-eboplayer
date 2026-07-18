import {ComponentView} from "./view";
import {AlbumUri, ExpandedAlbumModel, ExpandedStreamModel, PlaylistUri, TrackUri} from "../modelTypes";
import {EboBigAlbumComp} from "../components/album/eboBigAlbumComp";
import {EboBrowseComp} from "../components/browse/eboBrowseComp";
import {arrayToggle} from "../global";
import {GuiSourceArgs, SaveUriArgs, UriArgs} from "../events";
import {EboDialog} from "../components/eboDialog";
import {AlbumToView} from "../model";
import {State} from "../playerState";
import {EboNowPlayingComp} from "../components/eboNowPlayingComp";
import {MainView} from "./mainView";

export class AlbumView extends ComponentView<EboBigAlbumComp> {
    private onDialogOkClickedCallback: (dialog: EboDialog) => boolean | Promise<boolean> = () => true;
    private dialog: EboDialog;
    private albumBeingEdited: AlbumUri | null = null;

    constructor(state: State, dialog: EboDialog, component: EboBigAlbumComp) {
        super(state, component);
        this.dialog = dialog;
        this.dialog.on("dialogOkClicked.eboplayer", (ev) => {
            let innnerDialog = ev.detail.dialog;
            if(this.onDialogOkClickedCallback(innnerDialog))
                innnerDialog.close();
        });
    }

    bind() {
        this.component.on("playTrackClicked.eboplayer", async (ev) => {
            await this.onPlayTrackClicked(ev.detail.uri);
        });
        this.component.on("addTrackClicked.eboplayer", async (ev) => {
            await this.onAddTrackClicked(ev.detail.uri);
        });
        this.component.on("saveClicked.eboplayer", async (ev) => {
            await this.onSaveClicked(ev.detail);
        });
        this.component.on("trackClicked.eboplayer", (ev) => {
            this.component.selected_track_uris = arrayToggle<TrackUri>(this.component.selected_track_uris, ev.detail.uri as TrackUri);
        });
        this.component.on("playItemListClicked.eboplayer", async (ev) => {
            await this.onPlayItemListClick(ev.detail);
        });
        this.component.on("addItemListClicked.eboplayer", async (ev) => {
            await this.onAddItemListClick(ev.detail);
        });
        this.component.on("replaceItemListClicked.eboplayer", async (ev) => {
            await this.onReplaceItemListClick(ev.detail);
        });
        this.component.on("updateAlbumData.eboplayer", async (ev) => {
            await this.state.getController().webProxy.updateAlbumData(ev.detail.uri as AlbumUri);
        });
        this.component.on("uploadAlbumImageClicked.eboplayer", async (ev) => {
            await this.state.getController().webProxy.uploadAlbumImages(ev.detail.albumUri, ev.detail.imageUrl);
        });
        this.component.on("browseToArtist.eboplayer", async (ev) => {
            await this.state.getController().viewController.browseToArtist(ev.detail);
        });
        this.component.on("albumGenreEditRequested.eboplayer", (ev) => {
            this.onGenreEditRequested(ev.detail);
        });
        this.state.getModel().on("favoritesChanged.eboplayer", ev => {
            this.component.updateFavorite();
        });
        this.state.getModel().on("volumeAdjustChanged.eboplayer", (ev) => {
            this.component.updateVolumeAdjust();
        })
        this.state.getModel().on("selectedTrackChanged.eboplayer", async () => {
            await this.onSelectedTrackChanged();
        });
        this.state.getModel().on("albumToViewChanged.eboplayer", async () => {
            await this.onAlbumToViewChanged();
        });
        this.state.getModel().on("viewChanged.eboplayer", async (ev) => {
            this.component.btn_states = MainView.getListButtonStates(this.state.getModel().getPage());
        });
    }

    private async onSelectedTrackChanged() {
        let uri = this.state.getModel().getSelectedTrack();
        this.state.getController().cache.lookupTrackCached(uri)
            .then(async track => {
                if(track?.type == "file") {
                    if(track.track.album) {
                        let albumModel = await this.state.getController().getExpandedAlbumModel(track.track.album.uri);
                        this.setAlbumComponentData(albumModel, track.track.uri as TrackUri); //Shoudln't be a Stream.
                    }
                    //else: album view will not be shown when track has no album...but are we sure?
                }
                else if(track?.type == "stream") {
                    let streamModel = await this.state.getController().getExpandedTrackModel(track.track.uri) as ExpandedStreamModel;
                    this.component.albumInfo = null;
                    this.component.setAttribute("img", streamModel.bigImageUrl);
                    this.component.setAttribute("name", streamModel.stream.name);
                    let timelineDetails = document.getElementById("timelineDetails") as EboNowPlayingComp;
                    timelineDetails.streamInfo = streamModel;
                }
            });
    }

    private async onAlbumToViewChanged() {
        let albumToView = this.state.getModel().getAlbumToView();
        if(!albumToView)
            return;
        let albumModel = await this.state.getController().getExpandedAlbumModel(albumToView.albumUri);
        this.setAlbumComponentData(albumModel, albumToView.selectedTrackUri);
    }

    setAlbumComponentData(albumModel: ExpandedAlbumModel, selectedTrackUri: TrackUri | null) {
        this.component.albumInfo = albumModel;
        this.component.selected_track_uris = selectedTrackUri ? [selectedTrackUri] : [];
        this.component.setAttribute("img", albumModel.bigImageUrl);
        if(albumModel.album.albumInfo) {
            this.component.setAttribute("name", albumModel.meta?.albumTitle ?? albumModel.album.albumInfo.name);
            this.component.dataset.albumUri = albumModel.album.albumInfo.uri;
        }
    }

    private async onPlayItemListClick(_detail: GuiSourceArgs) {
        await this.state.getPlayer().clearAndPlay(await this.getSelectedUriForAlbum());
    }

    private async onAddItemListClick(_detail: GuiSourceArgs) {
        await this.state.getPlayer().add(await this.getSelectedUriForAlbum());
    }

    private async onReplaceItemListClick(detail: GuiSourceArgs) {
        await this.state.getPlayer().clear();
        await this.onAddItemListClick(detail);
    }

    private async onPlayTrackClicked(uri: TrackUri) {
        await this.state.getPlayer().clearAndPlay([uri]);
    }

    private async onAddTrackClicked(uri: TrackUri) {
    }

    private async getSelectedUriForAlbum() {
        let trackUris = this.component.selected_track_uris;

        if (trackUris.length != 0) {
            return trackUris;
        }

        //No selection? Take the whole album.
        let albumToView = this.state.getModel().getAlbumToView() as AlbumToView; //Shouldn't be null.'
        return [albumToView.albumUri];
    }

    private async onSaveClicked(detail: SaveUriArgs) {
        if (detail.source == "albumView") {
            let dialogContent = `
                <label for="playListName">Name</label>
                <input type="text" id="playListName">
            `;
            this.showDialog(dialogContent, "Save", (dialog) => {
                let playlistName = dialog.querySelector("#playListName") as HTMLInputElement;
                let name = playlistName.value;
                return this.saveAlbumAsPlaylist(name, detail);
            });
        }
    }

    showDialog(contentHtml: string, okButtonText: string, onOkClicked: (dialog: EboDialog) => boolean | Promise<boolean>) {
        this.onDialogOkClickedCallback = onOkClicked;
        this.dialog.innerHTML = contentHtml;
        this.dialog.showModal();
        this.dialog.setAttribute("ok_text", okButtonText);
    }

    async saveAlbumAsPlaylist(name: string, detail: SaveUriArgs) {
        let playlistUri = await this.state.getController().createPlaylist(name);
        await this.state.getController().addRefToPlaylist(playlistUri as PlaylistUri, detail.uri, "album", -1);
        return true;
    }

    private onGenreEditRequested(detail: UriArgs) {
        location.hash = "#Genres";
        this.state.getController().localStorageProxy.saveAlbumBeingEdited(detail.uri as AlbumUri);
        location.reload();
    }

}
