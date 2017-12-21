'use strict';

import * as vscode from 'vscode';
import Redirector from "./Redirector";
import Property from "./Property";
import Configuration from "./Configuration";

class Resolver {
    config: Configuration;

    /**
     * Types that won't be recognised as valid type hints
     */
    pseudoTypes = ['mixed', 'number', 'callback', 'object', 'void'];

    public constructor()
    {
        const editor = this.activeEditor();

        if (editor.document.languageId !== 'php') {
            throw new Error('Not a PHP file.');
        }

        this.config = new Configuration;
    }


    activeEditor() {
        return vscode.window.activeTextEditor;
    }

    closingClassLine() {
        const editor = this.activeEditor();

        for (let lineNumber = editor.document.lineCount - 1; lineNumber > 0; lineNumber--) {
            const line = editor.document.lineAt(lineNumber);
            const text = line.text;

            if (text.startsWith('}')) {
                return line;
            }
        }

        return null;
    }

    insertGetter() {
        this.renderTemplate(this.getterTemplate());
    }

    insertGetterAndSetter(){
        this.renderTemplate(this.getterTemplate() + this.setterTemplate());
    }

    insertSetter() {
        this.renderTemplate(this.setterTemplate());
    }

    getterTemplate() {
        const editor = this.activeEditor();
        let prop = null;

        try {
            prop = Property.fromEditorSelection(editor);
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
            return null;
        }

        const name = prop.getName();
        const description = prop.getDescription();
        const tab = prop.getIndentation();
        const type = prop.getType();
        const spacesAfterReturn = Array(this.config.getInt('spacesAfterReturn', 2) + 1).join(' ');

        return  (
            `\n`
            + tab + `/**\n`
            + tab + ` * ` + prop.getterDescription() + `\n`
            + (type ? tab + ` *\n` : ``)
            + (type ? tab + ` * @return` + spacesAfterReturn + type + `\n` : ``)
            + tab + ` */ \n`
            + tab + `public function ` + prop.getterName() + `()\n`
            + tab + `{\n`
            + tab + tab + `return $this->` + name + `;\n`
            + tab + `}\n`
        );
    }

    setterTemplate() {
        const editor = this.activeEditor();
        let prop = null;

        try {
            prop = Property.fromEditorSelection(editor);
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
            return null;
        }

        const name = prop.getName();
        const description = prop.getDescription();
        const tab = prop.getIndentation();
        const type = prop.getType();
        const typeHint = prop.getTypeHint();
        const spacesAfterParam = Array(this.config.getInt('spacesAfterParam', 2) + 1).join(' ');
        const spacesAfterParamVar = Array(this.config.getInt('spacesAfterParamVar', 2) + 1).join(' ');
        const spacesAfterReturn = Array(this.config.getInt('spacesAfterReturn', 2) + 1).join(' ');

        return (
            `\n`
            + tab + `/**\n`
            + tab + ` * ` + prop.setterDescription() + `\n`
            + (type ? tab + ` *\n` : ``)
            + (type ? tab + ` * @param` + spacesAfterParam + type + spacesAfterParamVar + `$` + name + (description ? `  ` + description : ``) + `\n` : ``)
            + tab + ` *\n`
            + tab + ` * @return` + spacesAfterReturn + `self\n`
            + tab + ` */ \n`
            + tab + `public function ` + prop.setterName() + `(` + (typeHint ? typeHint + ` ` : ``) + `$` + name + `)\n`
            + tab+ `{\n`
            + tab + tab + `$this->` + name + ` = $` + name + `;\n`
            + `\n`
            + tab + tab + `return $this;\n`
            + tab + `}\n`
        );
    }

    renderTemplate(template: string) {
        if (!template) {
            return;
        }

        let insertLine = this.insertLine();

        if (!insertLine) {
            return;
        }

        const editor = this.activeEditor();
        let resolver = this;

        editor.edit(function(edit: vscode.TextEditorEdit){
            edit.replace(
                new vscode.Position(insertLine.lineNumber, 0),
                template
            );
        }).then(
            success => {
                if (resolver.isRedirectEnabled() && success) {
                    const redirector = new Redirector(editor);
                    redirector.goToLine(this.closingClassLine().lineNumber - 1);
                }
            },
            error => {
                vscode.window.showErrorMessage(`Error generating functions: ` + error);
            }
        );
    }

    insertLine() {
        return this.closingClassLine();
    }

    isRedirectEnabled() : boolean {
        return true === this.config.get('redirect', true);
    }
}

function activate(context: vscode.ExtensionContext) {
    let resolver = new Resolver;

    let insertGetter = vscode.commands.registerCommand('phpGettersSetters.insertGetter', () => resolver.insertGetter());
    let insertSetter = vscode.commands.registerCommand('phpGettersSetters.insertSetter', () => resolver.insertSetter());
    let insertGetterAndSetter = vscode.commands.registerCommand('phpGettersSetters.insertGetterAndSetter', () => resolver.insertGetterAndSetter());

    context.subscriptions.push(insertGetter);
    context.subscriptions.push(insertSetter);
    context.subscriptions.push(insertGetterAndSetter);
}

function deactivate() {
}

exports.activate = activate;
exports.deactivate = deactivate;
