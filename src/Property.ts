
'use strict';

import * as vscode from 'vscode';

export default class Property {
    private description: string = null;
    private indentation: string;
    private name: string;
    private type: string = null;
    private typeHint: string = null;
    private pseudoTypes = ['mixed', 'number', 'callback', 'array|object', 'void', 'null', 'integer'];

    public constructor(name: string)
    {
        this.name = name;
    }

    static fromEditorPosition(editor: vscode.TextEditor, activePosition: vscode.Position) {
        const wordRange = editor.document.getWordRangeAtPosition(activePosition);

        if (wordRange === undefined) {
            throw new Error('No property found. Please select a property to use this extension.');
        }

        const selectedWord = editor.document.getText(wordRange);

        if (selectedWord[0] !== '$') {
            throw new Error('No property found. Please select a property to use this extension.');
        }

        let property = new Property(selectedWord.substring(1, selectedWord.length));

        const activeLineNumber = activePosition.line;
        const activeLine = editor.document.lineAt(activeLineNumber);

        property.indentation = activeLine.text.substring(0, activeLine.firstNonWhitespaceCharacterIndex);

        const previousLineNumber = activeLineNumber - 1;

        if (previousLineNumber <= 0) {
            return property;
        }

        const previousLine = editor.document.lineAt(previousLineNumber);

        // No doc block found
        if (!previousLine.text.endsWith('*/')) {
            return property;
        }

        let multilineDescription = [];
        for (let line = previousLineNumber - 1; line > 0; line--) {
            const text = editor.document.lineAt(line).text;

            // Reached the end of the doc block
            if (text.includes('/**') || !text.includes('*')) {
                if (!property.description && multilineDescription.length > 0) {
                    property.description = property.stringifyMultilineDescription(multilineDescription);
                }

                break;
            }

            // Remove spaces & tabs
            const lineParts = text.split(' ').filter(function(value){
                return value !== '' && value !== "\t" && value !== "*";
            });

            const varPosition = lineParts.indexOf('@var');

            // Found @var line
            if (varPosition !== -1) {
                property.setType(lineParts[varPosition + 1]);

                var descriptionParts = lineParts.slice(varPosition + 2);

                if (descriptionParts.length) {
                    property.description = descriptionParts.join(` `);
                }

                continue;
            }

            let possibleDescription = lineParts.join(` `);
            if (possibleDescription[0] !== '@') {
                multilineDescription = [text, ...multilineDescription];
            }
        }

        return property;
    }

    static fromEditorSelection(editor: vscode.TextEditor) {
        return Property.fromEditorPosition(editor, editor.selection.active);
    }

    generateMethodDescription(prefix : string) : string {
        if (this.description) {
            return prefix + this.description.charAt(0).toLowerCase() + this.description.substring(1);
        }

        return prefix + `the value of ` + this.name;
    }

    generateMethodName(prefix : string) : string {
        const inflectedPropertyName = (this.name.charAt(0) === '_')
            ? this.name.charAt(1).toUpperCase() + this.name.substring(2)
            : this.name.charAt(0).toUpperCase() + this.name.substring(1);

        return prefix + inflectedPropertyName;
    }

    getDescription() : string {
        return this.description;
    }

    getIndentation() : string {
        return this.indentation;
    }

    getName() : string {
        return this.name;
    }

    getterDescription() : string {
        return this.generateMethodDescription('Get ');
    }

    getterName() : string {
        return this.generateMethodName('get');
    }

    getType() : string {
        return this.type;
    }

    getTypeHint() : string {
        return this.typeHint;
    }

    isValidTypeHint(type : string) {
        return (-1 === type.indexOf('|') && -1 === this.pseudoTypes.indexOf(type));
    }

    setterDescription() : string {
        return this.generateMethodDescription('Set ');
    }

    setterName() : string {
        return this.generateMethodName('set');
    }

    setType(type : string) {
        this.type = type;

        if (this.isValidTypeHint(type)) {
            this.typeHint = type;
        }
    }

    stringifyMultilineDescription(multilineDescription: string[]): string {
        const leftTrimLine = (line: string) => line.replace(/^\s*\*\s*/, '');
        // remove the `    * ` from the first description line.
        multilineDescription[0] = leftTrimLine(multilineDescription[0]);

        // it can be a single line description too !
        if (multilineDescription.length === 1) {
            return multilineDescription[0];
        }

        // remove the last line if it's empty
        const lastLine = leftTrimLine(multilineDescription[multilineDescription.length -1]);
        if (lastLine === '') {
            multilineDescription = multilineDescription.slice(0, -1);
        }

        return multilineDescription.join("\n");
    }
}
