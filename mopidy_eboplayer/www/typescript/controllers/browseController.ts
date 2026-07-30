import Controller, {LIBRARY_PROTOCOL} from "./controller";
import {
    AlbumUri,
    AllUris,
    BreadCrumbBrowseFilter, BreadCrumbHome,
    BreadCrumbRef,
    BrowseFilter,
    ExpandedFileTrackModel, isBreadCrumbForAlbum,
    StreamUri,
    TrackUri
} from "../modelTypes";
import {Refs, SomeRefs} from "../refs";
import models from "../../js/mopidy";
import Ref = models.Ref;
import {Model} from "../model";

export class BrowseController {
    private controller: Controller;
    private model: Model;
    constructor(controller: Controller, model: Model) {
        this.controller = controller;
        this.model = model;
    }

    async diveIntoBrowseResult(label: string, uri: AllUris, type: string, addTextFilterBreadcrumb: boolean) {
        if(type == "track") {
            let track = await this.controller.getExpandedTrackModel(uri as TrackUri) as ExpandedFileTrackModel;
            if(track.album?.albumInfo?.uri)
                this.controller.viewController.showAlbum(track.album?.albumInfo?.uri, uri as TrackUri);
            //else: don't dive
            return; //don't change the breadcrumb and filter.
        }

        if(type == "album") {
            this.controller.viewController.gotoAlbum(uri as AlbumUri);
        }

        if(type  == "radio") {
            this.controller.getExpandedTrackModel(uri as StreamUri).then(() => { //fetch before changing view, to avoid flicker.
                this.controller.viewController.showRadio(uri as StreamUri);
            });
        }

        // set 2 new breadCrumbs and a new browseFilter.
        // > setting the browseFilter should only trigger a view update. NOT a re-filter!!!
        if(addTextFilterBreadcrumb) {
            let browseFilter = this.model.getCurrentBrowseFilter();
            if(! browseFilter.isEmpty()) {
                let breadCrumb1 = new BreadCrumbBrowseFilter(browseFilter.searchText, browseFilter);
                this.model.pushBreadCrumb(breadCrumb1, "noDispatch");
            }
        }
        let ref: Ref<AllUris> = {type: type as models.ModelType, name: label, uri};
        let breadCrumb2 = new BreadCrumbRef(label, ref);
        this.model.pushBreadCrumb(breadCrumb2);

        this.controller.localStorageProxy.saveBrowseFilterBreadCrumbs(this.model.getBreadCrumbs());

        let newBrowseFilter = new BrowseFilter();
        //for each type, we dive into the next level of type. E.g., artist -> album -> track.
        switch (type) {
            case "artist": newBrowseFilter.album = true; break;
            case "genre":
                newBrowseFilter.radio = true;
                newBrowseFilter.playlist = true;
                newBrowseFilter.artist = true;
                newBrowseFilter.album = true;
                newBrowseFilter.track = true;
                newBrowseFilter.genre = true;
                break;
            case "playlist":
                newBrowseFilter.playlist = true;
                newBrowseFilter.artist = true;
                newBrowseFilter.album = true;
                newBrowseFilter.track = true;
                newBrowseFilter.radio = true;
                break;
        }
        await this.setAndSaveBrowseFilter(newBrowseFilter, "dontApply");

        await this.fetchRefsForCurrentBreadCrumbs()
        await this.filterBrowseResults();
    }

    async setWhatsNewFilter() {
        await this.clearBreadCrumbs();
        let browseFilter = new BrowseFilter();
        browseFilter.addedSince = 1;
        this.controller.localStorageProxy.saveCurrentBrowseFilter(browseFilter);
        this.model.setCurrentBrowseFilter(browseFilter);
    }

    async setAndSaveBrowseFilter(filter: BrowseFilter, applyFilter: "apply" | "dontApply" = "apply") {
        this.controller.localStorageProxy.saveCurrentBrowseFilter(filter);
        this.model.setCurrentBrowseFilter(filter);
        if(applyFilter == "apply")
            await this.filterBrowseResults();
    }

    async clearBreadCrumbs() {
        this.model.resetBreadCrumbsTo(this.model.getBreadCrumbs()[0].id);
    }

    async resetToBreadCrumb(id: number) {
        let breadCrumb = this.model.getBreadCrumbs().get(id);
        let breadCrumbs = this.model.getBreadCrumbs();

        //if the breadCrumb is a browseFilter, reset to the previous breadCrumb and set the current browseFilter to the one in the breadCrumb.
        if(breadCrumb instanceof BreadCrumbBrowseFilter) {
            this.model.resetBreadCrumbsTo(id);
            let browseFilter = this.model.popBreadCrumb()?.data as BrowseFilter;
            await this.setAndSaveBrowseFilter(browseFilter);
            this.controller.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
            await this.fetchRefsForCurrentBreadCrumbs()
            await this.filterBrowseResults();
        } else if(breadCrumb instanceof BreadCrumbRef) {
            if(isBreadCrumbForAlbum(breadCrumb)) {
                this.controller.viewController.showAlbum(breadCrumb.data.uri, null);
                return;
            }
            this.model.resetBreadCrumbsTo(id);
            this.model.popBreadCrumb(); // remove the current breadCrumb as it will be added again below.
            await this.diveIntoBrowseResult(breadCrumb.label, breadCrumb.data.uri, breadCrumb.data.type, false);
        } else if (breadCrumb instanceof BreadCrumbHome) {
            this.model.resetBreadCrumbsTo(id);
            await this.setAndSaveBrowseFilter(new BrowseFilter());
            this.controller.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
            await this.fetchRefsForCurrentBreadCrumbs()
            await this.filterBrowseResults();
        }
    }

    async setFavoritesFilter() {
        let favoritesName = await this.controller.cache.getFavoritePlaylistName();
        let allRefs = await this.controller.cache.getAllRefsCached();
        let favoritesRef = allRefs.playlists.find(res => res.item.name == favoritesName);
        if(!favoritesRef)
            return;
        await this.clearBreadCrumbs();
        await this.diveIntoBrowseResult(favoritesName, favoritesRef.item.uri, "playlist", false);
    }

    async fetchRefsForCurrentBreadCrumbs() {
        let breadCrumbs = this.model.getBreadCrumbs();
        let lastCrumb = breadCrumbs.getLast();
        if(!lastCrumb) {
            await this.controller.setAllRefsAsCurrent();
            return;
        }

        if(lastCrumb instanceof BreadCrumbHome) {
            await this.controller.setAllRefsAsCurrent();
            return;
        }

        if(lastCrumb instanceof BreadCrumbBrowseFilter) {
            await this.controller.setAllRefsAsCurrent();
            return;
        }

        if(lastCrumb instanceof BreadCrumbRef) {
            if(lastCrumb.data.type == "playlist") {
                let playlistItems = await this.controller.mopidyProxy.fetchPlaylistItems(lastCrumb.data.uri);
                playlistItems.forEach(ref => {
                    //"local:track:Air/Moon%20Safari/01%20La%20Femme%20d%27Argent.wma"

                    if(!ref.name || ref.name == "") {
                        ref.name = ref.uri
                            .replace(LIBRARY_PROTOCOL + "track:", "")
                            .replaceAll("%20", " ");
                        //remove the last part of the uri, which is the file extension.
                        ref.name = ref.name.split(".").slice(0, -1).join(".");
                    }
                });
                let results = await Refs.transformRefsToSearchResults(this.controller.cache, playlistItems);
                this.model.setCurrentRefs(new SomeRefs(results));
                return;
            }

            let refs = await this.controller.mopidyProxy.browse(lastCrumb.data.uri);
            let results = await Refs.transformRefsToSearchResults(this.controller.cache, refs);
            this.model.setCurrentRefs(new SomeRefs(results));
            return;
        }
    }

    async filterBrowseResults() {
        await this.model.filterCurrentRefs();
    }
}