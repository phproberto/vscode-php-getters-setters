'use strict';

import * as vscode from 'vscode';
import Redirector from "./Redirector";
import Property from "./Property";
import Configuration from "./Configuration";
import TemplatesManager from './TemplatesManager';

class Resolver {
    config: Configuration;
    templatesManager: TemplatesManager;

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
        this.templatesManager = new TemplatesManager;
    }


    activeEditor() {
        return vscode.window.activeTextEditor;
    }

    closingClassLine() {
        const editor = this.activeEditor();

        for (let lineNumber = editor.document.lineCount - 1; lineNumber > 0; lineNumber--) {
            const line = editor.document.lineAt(lineNumber);
            const text = line.text.trim();

            if (text.startsWith('}')) {
                return line;
            }
        }

        return null;
    }

    insertGetter() {
        const editor = this.activeEditor();
        let property = null;
        let content = '';

        for (let index = 0; index < editor.selections.length; index++) {
            const selection = editor.selections[index];

            try {
                property = Property.fromEditorPosition(editor, selection.active);
            } catch (error) {
                this.showErrorMessage(error.message);
                return null;
            }

            content += this.getterTemplate(property);
        }

        this.renderTemplate(content);
    }

    insertGetterAndSetter(){
        const editor = this.activeEditor();
        let property = null;
        let content = '';

        for (let index = 0; index < editor.selections.length; index++) {
            const selection = editor.selections[index];

            try {
                property = Property.fromEditorPosition(editor, selection.active);
            } catch (error) {
                this.showErrorMessage(error.message);
                return null;
            }

            content += this.getterTemplate(property) + this.setterTemplate(property);
        }

        this.renderTemplate(content);
    }

    insertSetter() {
        const editor = this.activeEditor();
        let property = null;
        let content = '';

        for (let index = 0; index < editor.selections.length; index++) {
            const selection = editor.selections[index];

            try {
                property = Property.fromEditorPosition(editor, selection.active);
            } catch (error) {
                this.showErrorMessage(error.message);
                return null;
            }

            content += this.setterTemplate(property);
        }

        this.renderTemplate(content);
    }

    getterTemplate(prop: Property) {
        const name = prop.getName();
        const description = prop.getDescription();
        const tab = prop.getIndentation();
        const type = prop.getType();
        const spacesAfterReturn = Array(this.config.getInt('spacesAfterReturn', 2) + 1).join(' ');
        const templateFile = this.config.get('getterTemplate', 'getter.js');

        if (this.templatesManager.exists(templateFile)) {
            const template = require(this.templatesManager.path(templateFile));

            return template(prop);
        }

        return  (
            `\n`
            + tab + `/**\n`
            + tab + ` * ` + prop.getterDescription() + `\n`
            + (type ? tab + ` *\n` : ``)
            + (type ? tab + ` * @return` + spacesAfterReturn + type + `\n` : ``)
            + tab + ` */\n`
            + tab + `public function ` + prop.getterName() + `()\n`
            + tab + `{\n`
            + tab + tab + `return $this->` + name + `;\n`
            + tab + `}\n`
        );
    }

    setterTemplate(prop: Property) {
        const name = prop.getName();
        const description = prop.getDescription();
        const tab = prop.getIndentation();
        const type = prop.getType();
        const typeHint = prop.getTypeHint();
        const spacesAfterParam = Array(this.config.getInt('spacesAfterParam', 2) + 1).join(' ');
        const spacesAfterParamVar = Array(this.config.getInt('spacesAfterParamVar', 2) + 1).join(' ');
        const spacesAfterReturn = Array(this.config.getInt('spacesAfterReturn', 2) + 1).join(' ');

        const templateFile = this.config.get('setterTemplate', 'setter.js');

        if (this.templatesManager.exists(templateFile)) {
            const template = require(this.templatesManager.path(templateFile));

            return template(prop);
        }

        return (
            `\n`
            + tab + `/**\n`
            + tab + ` * ` + prop.setterDescription() + `\n`
            + (type ? tab + ` *\n` : ``)
            + (type ? tab + ` * @param` + spacesAfterParam + type + spacesAfterParamVar + `$` + name + (description ? `  ` + description : ``) + `\n` : ``)
            + tab + ` *\n`
            + tab + ` * @return` + spacesAfterReturn + `self\n`
            + tab + ` */\n`
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
            this.showErrorMessage('Missing template to render.');
            return;
        }

        let insertLine = this.insertLine();

        if (!insertLine) {
            this.showErrorMessage('Unable to detect insert line for template.');
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
                this.showErrorMessage(`Error generating functions: ` + error);
            }
        );
    }

    insertLine() {
        return this.closingClassLine();
    }

    isRedirectEnabled() : boolean {
        return true === this.config.get('redirect', true);
    }

    showErrorMessage(message: string) {
        message = 'phpGettersSetters error: ' + message.replace(/\$\(.+?\)\s\s/, '');

        vscode.window.showErrorMessage(message);
    }

    showInformationMessage(message: string) {
        message = 'phpGettersSetters info: ' + message.replace(/\$\(.+?\)\s\s/, '');

        vscode.window.showInformationMessage(message);
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
