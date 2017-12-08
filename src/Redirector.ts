'use strict';

import * as vscode from 'vscode';

export default class Redirector {
    editor: vscode.TextEditor;

    public constructor(editor?: vscode.TextEditor)
    {
        this.editor = editor ? editor : vscode.window.activeTextEditor;
    }

    goToLine(lineNumber : number) {
        const line = this.editor.document.lineAt(lineNumber);
        this.editor.revealRange(line.range);

        const newPosition = new vscode.Position(line.lineNumber, line.range.end.character);
        this.editor.selection = new vscode.Selection(newPosition, newPosition);
    }
}