import {BrowseFilterBreadCrumbs, Model} from "./model";
import {jsonParse} from "./functionsvars";
import {BrowseFilter, FilterBreadCrumbType} from "./modelTypes";
import {BreadCrumbStack} from "./breadCrumb";

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
        console.error("Could not load or parse browse filters from local storage. Using default filters.");
    }

    loadBrowseFiltersBreadCrumbs() {
        let breadCrumbsString = localStorage.getItem(BROWSE_FILTERS_BREADCRUMBS_KEY);
        if (breadCrumbsString) {
            let breadCrumbsArray = jsonParse(breadCrumbsString, this.model.getBreadCrumbs().list());
            let breadCrumbs = new BreadCrumbStack<FilterBreadCrumbType>();
            breadCrumbs.setArray(breadCrumbsArray);
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