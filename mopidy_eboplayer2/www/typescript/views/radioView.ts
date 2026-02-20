import {ComponentView} from "./view";
import {StreamUri, ExpandedAlbumModel, PlaylistUri, TrackUri, ExpandedStreamModel} from "../modelTypes";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {arrayToggle} from "../global";
import {GuiSourceArgs, SaveUriArgs, UriArgs} from "../events";
import {EboDialog} from "../components/eboDialog";
import {AlbumToView} from "../model";
import {State} from "../playerState";
import {EboBigRadioComp} from "../components/eboBigRadioComp";

export class RadioView extends ComponentView<EboBigRadioComp> {
    private onDialogOkClickedCallback: (dialog: EboDialog) => boolean | Promise<boolean> = () => true;
    private dialog: EboDialog;
    private radioBeingEdited: StreamUri | null = null;

    constructor(state: State, dialog: EboDialog, component: EboBigRadioComp) {
        super(state, component);
        this.dialog = dialog;
        this.dialog.addEboEventListener("dialogOkClicked.eboplayer", (ev) => {
            let innnerDialog = ev.detail.dialog;
            if(this.onDialogOkClickedCallback(innnerDialog))
                innnerDialog.close();
        });
    }

    bind() {
        this.component.addEboEventListener("saveClicked.eboplayer", async (ev) => {
            await this.onSaveClicked(ev.detail);
        });
        this.component.addEboEventListener("playItemListClicked.eboplayer", async (ev) => {
            await this.onPlayItemListClick(ev.detail);
        });
        this.component.addEboEventListener("addItemListClicked.eboplayer", async (ev) => {
            await this.onAddItemListClick(ev.detail);
        });
        this.component.addEboEventListener("replaceItemListClicked.eboplayer", async (ev) => {
            await this.onReplaceItemListClick(ev.detail);
        });
        //todo
        // this.component.addEboEventListener("uploadAlbumImageClicked.eboplayer", async (ev) => {
        //     await this.state.getController().webProxy.uploadAlbumImages(ev.detail.streamUri, ev.detail.imageUrl);
        // });
        this.component.addEboEventListener("albumGenreEditRequested.eboplayer", (ev) => {
            this.onGenreEditRequested(ev.detail);
        });
        this.state.getModel().addEboEventListener("favoritesChanged.eboplayer", async ev => {
            await this.onFavoritesChanged();
        });

    }

    setStreamComponentData(streamModel: ExpandedStreamModel) {
        let albumComp = document.getElementById("bigRadioView") as EboBigRadioComp;
        this.component.streamInfo = streamModel;
        this.component.setAttribute("img", streamModel.bigImageUrl);
        this.component.setAttribute("name", streamModel.stream.name);
        this.component.dataset.streamUri = streamModel.bigImageUrl;
    }

    private async onPlayItemListClick(_detail: GuiSourceArgs) {
        let currentRadio = this.state.getModel().getRadioToView();
        if(currentRadio)
            await this.state.getPlayer().clearAndPlay([currentRadio]);
    }

    private async onAddItemListClick(_detail: GuiSourceArgs) {
        let currentRadio = this.state.getModel().getRadioToView();
        if(currentRadio)
            await this.state.getPlayer().add([currentRadio]);
    }

    private async onReplaceItemListClick(detail: GuiSourceArgs) {
        await this.state.getPlayer().clear();
        await this.onAddItemListClick(detail);
    }

    private async onSaveClicked(detail: SaveUriArgs) {
        if (detail.source == "radioView") {
            let dialogContent = `
                <label for="playListName">Name</label>
                <input type="text" id="playListName">
            `;
            this.showDialog(dialogContent, "Save", (dialog) => {
                let playlistName = dialog.querySelector("#playListName") as HTMLInputElement;
                let name = playlistName.value;
                return this.saveStreamToPlaylist(name, detail);
            });
        }
    }

    showDialog(contentHtml: string, okButtonText: string, onOkClicked: (dialog: EboDialog) => boolean | Promise<boolean>) {
        this.onDialogOkClickedCallback = onOkClicked;
        this.dialog.innerHTML = contentHtml;
        this.dialog.showModal();
        this.dialog.setAttribute("ok_text", okButtonText);
    }

    async saveStreamToPlaylist(name: string, detail: SaveUriArgs) {
        let playlistUri = await this.state.getController().createPlaylist(name);
        await this.state.getController().addRefToPlaylist(playlistUri as PlaylistUri, detail.uri, "radio", -1);
        return true;
    }

    private onGenreEditRequested(detail: UriArgs) {
        location.hash = "#Genres";
        this.state.getController().localStorageProxy.saveRadioBeingEdited(detail.uri as StreamUri);
        location.reload();
    }

    private async onFavoritesChanged() {
        this.component.updateFavorite();
    }
}
