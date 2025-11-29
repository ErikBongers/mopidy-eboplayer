import {Model} from "./model";
import {jsonParse} from "./functionsvars";
import {BrowseFilter} from "./modelTypes";

const BROWSE_FILTERS_KEY = "browseFilters";

export class LocalStorageProxy {
    private model: Model;

    constructor(model: Model) {
        this.model = model;
    }

    loadBrowseFilters() {
        let browseFilters = localStorage.getItem(BROWSE_FILTERS_KEY);
        if (browseFilters) {
            let browseFilterObject = jsonParse(browseFilters, this.model.getBrowseFilter());
            let browseFilter = new BrowseFilter();
            Object.assign(browseFilter, browseFilterObject);
            this.model.setBrowseFilter(browseFilter);
            return;
        }
        console.error("Could not load or parse browse filters from local storage. Using default filters.");
    }

    saveBrowseFilters(browseFilters: BrowseFilter) {
        let obj = JSON.stringify(browseFilters);
        console.log(obj);
        localStorage.setItem(BROWSE_FILTERS_KEY, obj);
    }

}