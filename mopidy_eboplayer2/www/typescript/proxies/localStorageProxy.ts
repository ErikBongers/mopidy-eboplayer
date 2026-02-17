import {BrowseFilterBreadCrumbStack, Model} from "../model";
import {jsonParse} from "../functionsvars";
import {AlbumUri, AllUris, BreadCrumbBrowseFilter, BreadCrumbHome, BreadCrumbRef, BrowseFilter} from "../modelTypes";
import models from "../../js/mopidy";
import Ref = models.Ref;

const CURRENT_BROWSE_FILTERS__KEY = "currentBrowseFilters";
const BROWSE_FILTERS_BREADCRUMBS_KEY = "browseFiltersBreadCrumbs";

export class LocalStorageProxy {
    private model: Model;

    constructor(model: Model) {
        this.model = model;
    }

    loadCurrentBrowseFilter() {
        let browseFilterString = localStorage.getItem(CURRENT_BROWSE_FILTERS__KEY);
        if (browseFilterString) {
            let browseFilterObject = jsonParse(browseFilterString, this.model.getCurrentBrowseFilter());
            let browseFilter = new BrowseFilter();
            Object.assign(browseFilter, browseFilterObject);
            this.model.setCurrentBrowseFilter(browseFilter);
            return;
        }
        console.error("Could not load or parse browse filter bread crumbs from local storage. Using default bread crumbs.");
    }

    loadBrowseFiltersBreadCrumbs() {
        let breadCrumbsString = localStorage.getItem(BROWSE_FILTERS_BREADCRUMBS_KEY);
        if (breadCrumbsString) {
            let breadCrumbsArray = jsonParse(breadCrumbsString, this.model.getBreadCrumbs());
            let breadCrumbs = new BrowseFilterBreadCrumbStack();
            breadCrumbsArray
                .map(crumb => {
                    switch (crumb.type) {
                        case "browseFilter":
                            let browseFilter = new BrowseFilter();
                            Object.assign(browseFilter, crumb.data);
                            return new BreadCrumbBrowseFilter(crumb.label, browseFilter);
                        case "ref":
                            return new BreadCrumbRef(crumb.label, crumb.data as Ref<AllUris>);
                        case "home":
                            return new BreadCrumbHome();
                    }
                })
                .forEach(crumb =>
                    breadCrumbs.push(crumb));
            if(breadCrumbs.length == 0) {
                breadCrumbs.push(new BreadCrumbHome());
            }
            else {
                if (breadCrumbs[0].type != "home")
                    breadCrumbs.unshift(new BreadCrumbHome());
            }
            this.model.setBrowseFilterBreadCrumbs(breadCrumbs);
            return;
        }
        console.error("Could not load or parse browse filters from local storage. Using default filters.");
    }

    saveCurrentBrowseFilter(browseFilter: BrowseFilter) {
        let obj = JSON.stringify(browseFilter);
        console.log(obj);
        localStorage.setItem(CURRENT_BROWSE_FILTERS__KEY, obj);
    }

    saveBrowseFilterBreadCrumbs(breadCrumbs: BrowseFilterBreadCrumbStack) {
        let obj = JSON.stringify(breadCrumbs);
        console.log(obj);
        localStorage.setItem(BROWSE_FILTERS_BREADCRUMBS_KEY, obj);
    }

    saveAlbumBeingEdited(albumUri: AlbumUri | null) {
        localStorage.setItem("albumBeingEdited", albumUri ?? "");
    }

    getAlbumBeingEdited() {
        let albumUri = localStorage.getItem("albumBeingEdited") ?? "";
        if(albumUri == "")
            return null;

        return albumUri as AlbumUri;
    }
}