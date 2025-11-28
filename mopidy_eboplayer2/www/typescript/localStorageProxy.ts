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
            this.model.setBrowseFilter(jsonParse(browseFilters, this.model.getBrowseFilter()));
            return;
        }
        console.error("Could not load or parse browse filters from local storage. Using default filters.");
    }

    saveBrowseFilters(browseFilters: BrowseFilter) {
        localStorage.setItem(BROWSE_FILTERS_KEY, JSON.stringify(browseFilters));
    }

}