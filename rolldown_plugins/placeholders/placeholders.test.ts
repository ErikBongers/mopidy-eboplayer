import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createPlaceHolders} from "./placeholders";
import {Parser} from "htmlparserts/parser";
import {PeekingTokenizer} from "htmlparserts/PeekingTokenizer";
import {HtmlTokenizer} from "htmlparserts/HtmlTokenizer";

test('adds numbers', () => {
    assert.equal(1 + 1, 2);
    let zever="zever";
    let text = `"<div>Hello <img id='daImazz' src='prefix: {daSrc} suffix' toggle brol='${zever}'></div>"`;
    console.log(text);
    let placeholders = createPlaceHolders(text);
    // let parser = new Parser(new PeekingTokenizer(new HtmlTokenizer(text)));
    // let elements = parser.parse();
    // console.log(JSON.stringify(elements, null, 2));
    console.log(JSON.stringify(placeholders, null, 2));
});
