import {BrowseFilterBreadCrumbs, Model} from "../model";
import {jsonParse} from "../functionsvars";
import {BreadCrumbBrowseFilter, BreadCrumbRef, BrowseFilter, FilterBreadCrumbType} from "../modelTypes";
import {BreadCrumb, BreadCrumbStack} from "../breadCrumb";
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
            let breadCrumbsArray = jsonParse(breadCrumbsString, this.model.getBreadCrumbs().list());
            let breadCrumbs = new BreadCrumbStack<FilterBreadCrumbType>();
            breadCrumbsArray
                .map(crumb => {
                    switch (crumb.type) {
                        case "browseFilter": //todo: make this a const in BreadCrumbBrowseFilter
                            let browseFilter = new BrowseFilter();
                            Object.assign(browseFilter, crumb.data);
                            return new BreadCrumbBrowseFilter(crumb.label, browseFilter);
                        case "ref":
                            return new BreadCrumbRef(crumb.label, crumb.data as Ref);
                    }
                })
                .forEach(crumb =>
                    breadCrumbs.push(crumb));
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

    saveBrowseFilterBreadCrumbs(breadCrumbs: BrowseFilterBreadCrumbs) {
        let obj = JSON.stringify(breadCrumbs.list());
        console.log(obj);
        localStorage.setItem(BROWSE_FILTERS_BREADCRUMBS_KEY, obj);
    }

}