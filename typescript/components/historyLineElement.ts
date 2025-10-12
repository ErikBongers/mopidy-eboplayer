export class HistoryLineElement extends HTMLElement {
    private shadow: ShadowRoot;
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["name", "uri"];
    private name: string;
    private uri: string;
    constructor() {
        super();
        // let template = document.getElementById("history-line") as HTMLTemplateElement;
        // let content = template.content;
        this.shadow = this.attachShadow({mode: "open"});
        // this.root.appendChild(content.cloneNode(true));
    }

    // noinspection JSUnusedGlobalSymbols
    attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
        this[name] = newValue;
        this.render();
        }

    render() {
        let div = this.shadow.appendChild(document.createElement("div"));
        div.classList.add("textGlow");
        div.append(...this.childNodes);
        // div.appendChild(this.children[0]);//todo: add ALL children
//         this.shadow.innerHTML = `
// <div class="textGlow">
// <p class="redder" style="background-color: inherit">Name: [${this.name}]  --> (${this.uri})!</p>
// </div>
// `;
    }
    static define() {
        customElements.define("history-line", HistoryLineElement);
    }
}