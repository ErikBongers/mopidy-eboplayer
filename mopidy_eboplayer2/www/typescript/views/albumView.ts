import {ComponentView} from "./view";
import {EboPlayerDataType, ExpandedAlbumModel, PlaylistUri, TrackUri} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {arrayToggle, console_yellow} from "../global";
import {GuiSourceArgs, SaveUriArgs} from "../events";
import {EboDialog} from "../components/eboDialog";
import {AlbumToView} from "../model";
import {State} from "../playerState";

export class AlbumView extends ComponentView<EboBigAlbumComp> {
    override getRequiredDataTypes(): EboPlayerDataType[] {
        throw new Error("Method not implemented.");
    }
    private onDialogOkClickedCallback: (dialog: EboDialog) => boolean | Promise<boolean> = () => true;
    private dialog: EboDialog;

    constructor(state: State, dialog: EboDialog, component: EboBigAlbumComp) {
        super(state, component);
        this.dialog = dialog;
        this.dialog.addEboEventListener("dialogOkClicked.eboplayer", (ev) => {
            console_yellow("dialogOkClicked.eboplayer");
            let innnerDialog = ev.detail.dialog;
            if(this.onDialogOkClickedCallback(innnerDialog))
                innnerDialog.close();
        });
    }

    bind() {
        let currentTrackBigViewComp = document.getElementById("currentTrackBigView") as EboBrowseComp;
        currentTrackBigViewComp.addEboEventListener("bigTrackAlbumSmallImgClicked.eboplayer", async () => {
            currentTrackBigViewComp.setAttribute("show_back", "false");
        });
        this.component.addEboEventListener("playTrackClicked.eboplayer", async (ev) => {
            await this.onPlayTrackClicked(ev.detail.uri);
        });
        this.component.addEboEventListener("addTrackClicked.eboplayer", async (ev) => {
            await this.onAddTrackClicked(ev.detail.uri);
        });
        this.component.addEboEventListener("saveClicked.eboplayer", async (ev) => {
            await this.onSaveClicked(ev.detail);
        });
        this.component.addEboEventListener("trackClicked.eboplayer", (ev) => {
            this.component.selected_track_uris = arrayToggle<TrackUri>(this.component.selected_track_uris, ev.detail.uri as TrackUri);
        });
        //todo: perhaps create an albumView ?
        this.component.addEboEventListener("playItemListClicked.eboplayer", async (ev) => {
            await this.onPlayItemListClick(ev.detail);
        });
        this.component.addEboEventListener("addItemListClicked.eboplayer", async (ev) => {
            await this.onAddItemListClick(ev.detail);
        });
        this.component.addEboEventListener("replaceItemListClicked.eboplayer", async (ev) => {
            await this.onReplaceItemListClick(ev.detail);
        });
        this.component.addEboEventListener("updateAlbumData.eboplayer", async (ev) => {
            await this.state.getController().webProxy.updateAlbumImages(ev.detail.uri);
        });

    }

    setAlbumComponentData(albumModel: ExpandedAlbumModel, selectedTrackUri: TrackUri | null) {
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        this.component.albumInfo = albumModel;
        this.component.selected_track_uris = selectedTrackUri ? [selectedTrackUri] : [];
        this.component.setAttribute("img", albumModel.bigImageUrl);
        if(albumModel.album.albumInfo) {
            this.component.setAttribute("name", albumModel.meta?.albumTitle ?? albumModel.album.albumInfo.name);
            this.component.dataset.albumUri = albumModel.album.albumInfo.uri;
        }
    }

    private async onPlayItemListClick(_detail: GuiSourceArgs) {
        //todo: assuming this event is received from an album component!
        await this.state.getPlayer().clearAndPlay(await this.getSelectedUriForAlbum());
    }

    private async onAddItemListClick(_detail: GuiSourceArgs) {
        //todo: assuming this event is received from an album component!
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
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
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
        console_yellow(`Saving album to playlist ${name} as ${detail.uri}`);
        let playlist = await this.state.getController().createPlaylist(name);
        await this.state.getController().addRefToPlaylist(playlist.uri as PlaylistUri, detail.uri, "album", -1);
        return true;
    }
}
