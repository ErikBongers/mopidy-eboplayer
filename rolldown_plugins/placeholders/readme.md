# Placeholders

This rolldown/rollup plugin provides placeholders for html template strings in `EboComponent`s.

## Usage
The simplest form of a placeholder is shown below, with 2 placeholders: 
* a content placeholder 
* an attribute placeholder

```javascript
let myTemplate = template `
    <div id="person1" data-person-id="{personId}">{firstName}</div>
`;
```
Note that the element MUST have an id, as this will be used to find the element when updating the placeholder.

## Full format 
```javascript
let myTemplate = template `
    {placeholderId?trueValue:falseValue=defaultValue}
`;
```
Note that the `defaultValue` is for the whole placeholder, not just the `falseValue`.

## What is generated.

### Template changes.
At compile time, the placeholders are removed from the template string and replaced with the default value, if any.

...

## TODO

* Explain the render and update sequence.
* Explain properties
* Explain what is generated.